/**
 * SyncService - Manages multi-device sync between IndexedDB and Supabase
 * Handles conflict resolution, offline queues, and bidirectional sync
 */

export class SyncService {
  constructor(supabaseAdapter, repositories, logger = console) {
    this.supabase = supabaseAdapter;
    this.repos = repositories;
    this.logger = logger;
    this.syncQueue = [];
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  /**
   * Full sync: pull from Supabase, merge conflicts, push updates
   */
  async fullSync(userId) {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress');
      return { status: 'in-progress', queueLength: this.syncQueue.length };
    }

    this.isSyncing = true;
    const syncResult = {
      status: 'success',
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Phase 1: Pull from Supabase
      await this.pullBursaries(syncResult);
      await this.pullInstitutions(syncResult);
      await this.pullApplications(userId, syncResult);
      await this.pullNotifications(userId, syncResult);

      // Phase 2: Push local changes to Supabase
      await this.pushApplicationChanges(userId, syncResult);

      // Phase 3: Process sync queue
      await this.processSyncQueue(syncResult);

      this.lastSyncTime = new Date();
    } catch (error) {
      this.logger.error('Sync failed:', error);
      syncResult.status = 'failed';
      syncResult.errors.push(error.message);
    } finally {
      this.isSyncing = false;
    }

    return syncResult;
  }

  /**
   * Pull bursaries from Supabase and merge with local
   */
  async pullBursaries(syncResult) {
    try {
      const remoteBursaries = await this.supabase.listBursaries();
      const localBursaries = await this.repos.bursary.getAll();

      // Build lookup maps
      const remoteMap = new Map(remoteBursaries.map(b => [b.id, b]));
      const localMap = new Map(localBursaries.map(b => [b.id, b]));

      let updates = 0;

      // Update or insert from remote
      for (const [id, remoteBursary] of remoteMap) {
        const localBursary = localMap.get(id);

        if (!localBursary) {
          // New bursary: insert locally
          await this.repos.bursary.add(remoteBursary);
          updates++;
        } else if (this.isNewer(remoteBursary, localBursary)) {
          // Remote is newer: update locally
          await this.repos.bursary.update(id, remoteBursary);
          updates++;
        }
      }

      syncResult.pulled += updates;
      this.logger.debug(`Pulled ${updates} bursary updates`);
    } catch (error) {
      this.logger.error('Pull bursaries failed:', error);
      syncResult.errors.push(`Pull bursaries: ${error.message}`);
    }
  }

  /**
   * Pull institutions from Supabase and merge with local
   */
  async pullInstitutions(syncResult) {
    try {
      const remoteInstitutions = await this.supabase.listInstitutions();
      const localInstitutions = await this.repos.institution.getAll();

      const remoteMap = new Map(remoteInstitutions.map(i => [i.id, i]));
      const localMap = new Map(localInstitutions.map(i => [i.id, i]));

      let updates = 0;

      for (const [id, remoteInst] of remoteMap) {
        const localInst = localMap.get(id);

        if (!localInst) {
          await this.repos.institution.add(remoteInst);
          updates++;
        } else if (this.isNewer(remoteInst, localInst)) {
          await this.repos.institution.update(id, remoteInst);
          updates++;
        }
      }

      syncResult.pulled += updates;
      this.logger.debug(`Pulled ${updates} institution updates`);
    } catch (error) {
      this.logger.error('Pull institutions failed:', error);
      syncResult.errors.push(`Pull institutions: ${error.message}`);
    }
  }

  /**
   * Pull user's applications from Supabase
   */
  async pullApplications(userId, syncResult) {
    try {
      if (!userId) return;

      const remoteApplications = await this.supabase.listApplications(userId);
      const localApplications = await this.repos.application.getUserApplications(userId);

      const remoteMap = new Map(remoteApplications.map(a => [a.id, a]));
      const localMap = new Map(localApplications.map(a => [a.id, a]));

      let updates = 0;
      let conflicts = 0;

      for (const [id, remoteApp] of remoteMap) {
        const localApp = localMap.get(id);

        if (!localApp) {
          await this.repos.application.add(remoteApp);
          updates++;
        } else {
          // Check for conflict: both sides modified
          const localModified = new Date(localApp.updatedAt) > new Date(remoteApp.updatedAt);
          const remoteModified = new Date(remoteApp.updatedAt) > new Date(localApp.updatedAt);

          if (localModified && remoteModified) {
            // Conflict: user's local changes take precedence (last-write-wins with client bias)
            conflicts++;
            this.logger.warn(`Conflict on application ${id}: keeping local version`);
          } else if (remoteModified) {
            // Remote is newer: update locally
            await this.repos.application.update(id, remoteApp);
            updates++;
          }
        }
      }

      syncResult.pulled += updates;
      syncResult.conflicts += conflicts;
      this.logger.debug(`Pulled ${updates} applications, ${conflicts} conflicts`);
    } catch (error) {
      this.logger.error('Pull applications failed:', error);
      syncResult.errors.push(`Pull applications: ${error.message}`);
    }
  }

  /**
   * Pull user's notifications from Supabase
   */
  async pullNotifications(userId, syncResult) {
    try {
      if (!userId) return;

      const remoteNotifications = await this.supabase.listNotifications(userId);
      const localNotifications = await this.repos.notification.getUserNotifications(userId);

      const remoteMap = new Map(remoteNotifications.map(n => [n.id, n]));
      const localMap = new Map(localNotifications.map(n => [n.id, n]));

      let updates = 0;

      for (const [id, remoteNotif] of remoteMap) {
        const localNotif = localMap.get(id);

        if (!localNotif) {
          await this.repos.notification.add(remoteNotif);
          updates++;
        } else if (this.isNewer(remoteNotif, localNotif)) {
          await this.repos.notification.update(id, remoteNotif);
          updates++;
        }
      }

      syncResult.pulled += updates;
      this.logger.debug(`Pulled ${updates} notifications`);
    } catch (error) {
      this.logger.error('Pull notifications failed:', error);
      syncResult.errors.push(`Pull notifications: ${error.message}`);
    }
  }

  /**
   * Push local application changes to Supabase
   */
  async pushApplicationChanges(userId, syncResult) {
    try {
      if (!userId) return;

      const localApplications = await this.repos.application.getUserApplications(userId);
      let pushed = 0;

      for (const app of localApplications) {
        try {
          // Only push if app was modified locally but not yet synced
          const isSynced = app.syncedAt && new Date(app.syncedAt) >= new Date(app.updatedAt);
          if (!isSynced) {
            await this.supabase.createApplication(app);
            pushed++;
          }
        } catch (error) {
          this.logger.error(`Failed to push application ${app.id}:`, error);
          // Queue for retry
          this.syncQueue.push({ type: 'application', data: app, retries: 0 });
        }
      }

      syncResult.pushed += pushed;
      this.logger.debug(`Pushed ${pushed} application changes`);
    } catch (error) {
      this.logger.error('Push applications failed:', error);
      syncResult.errors.push(`Push applications: ${error.message}`);
    }
  }

  /**
   * Process queued sync operations (retries)
   */
  async processSyncQueue(syncResult) {
    const maxRetries = 3;
    const failedItems = [];

    for (const item of this.syncQueue) {
      try {
        if (item.type === 'application') {
          await this.supabase.createApplication(item.data);
        }

        item.retries++;
      } catch (error) {
        item.retries++;

        if (item.retries < maxRetries) {
          failedItems.push(item);
        } else {
          this.logger.error(`Failed to sync queue item after ${maxRetries} retries:`, item);
          syncResult.errors.push(`Queue retry failed: ${item.type} ${item.data.id}`);
        }
      }
    }

    this.syncQueue = failedItems;
  }

  /**
   * Helper: check if remote record is newer than local
   */
  isNewer(remote, local) {
    if (!local) return true;
    if (!remote.updatedAt || !local.updatedAt) return false;

    return new Date(remote.updatedAt) > new Date(local.updatedAt);
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queueLength: this.syncQueue.length,
      nextSyncDue: this.lastSyncTime ? new Date(this.lastSyncTime.getTime() + 5 * 60000) : new Date(),
    };
  }

  /**
   * Manually add item to sync queue (handles offline scenarios)
   */
  queueForSync(type, data) {
    this.syncQueue.push({ type, data, retries: 0 });
    this.logger.info(`Queued ${type} for sync`);
    return this.syncQueue.length;
  }
}

export default SyncService;
