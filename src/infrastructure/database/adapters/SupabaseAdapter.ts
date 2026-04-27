import type { DataAdapter } from '@/infrastructure/database/adapter';
import { supabase } from '@/lib/supabase';
import type { Bursary, Institution } from '@/data/staticData';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

/**
 * Supabase Adapter - Production backend for multi-user sync
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be configured
 * Falls back to local storage if Supabase is unavailable
 */
export const supabaseAdapter: DataAdapter = {
  async listBursaries(): Promise<Bursary[]> {
    if (!supabase) {
      console.warn('Supabase not configured, cannot sync bursaries');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('bursaries')
        .select(
          'id, name, provider, field, eligibility, deadline, amount, link, description, ' +
          'minAPS, provinceEligibility, isGolden, isSponsored, sponsorName, ' +
          'verificationStatus, needsReview, verificationSource, lastVerified, ' +
          'freshnessScore, linkHealthStatus, consecutiveBrokenChecks, quarantineReason'
        )
        .is('quarantineReason', null) // Exclude quarantined/broken bursaries
        .order('freshnessScore', { ascending: false })
        .order('deadline', { ascending: true });

      if (error) {
        console.error('Error fetching bursaries from Supabase:', error);
        return [];
      }

      return (data || []) as Bursary[];
    } catch (err) {
      console.error('Supabase bursaries fetch failed:', err);
      return [];
    }
  },

  async listInstitutions(): Promise<Institution[]> {
    if (!supabase) {
      console.warn('Supabase not configured, cannot sync institutions');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name, type, location, province, website, courses, image, description, rating')
        .order('rating', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching institutions from Supabase:', error);
        return [];
      }

      return (data || []) as Institution[];
    } catch (err) {
      console.error('Supabase institutions fetch failed:', err);
      return [];
    }
  },

  async listApplications(userId: string): Promise<Application[]> {
    if (!supabase) {
      console.warn('Supabase not configured, cannot sync applications');
      return [];
    }

    if (!userId) {
      console.warn('userId is required to fetch applications');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .select(
          'id, userId, bursaryId, status, deadlineDate, notes, documentsSubmitted, ' +
          'checklist, createdAt, updatedAt'
        )
        .eq('userId', userId)
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('Error fetching applications from Supabase:', error);
        return [];
      }

      return (data || []) as Application[];
    } catch (err) {
      console.error('Supabase applications fetch failed:', err);
      return [];
    }
  },

  async createApplication(application: Application): Promise<string> {
    if (!supabase) {
      console.warn('Supabase not configured, cannot create application');
      throw new Error('Supabase backend not available');
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert([{
          id: application.id,
          userId: application.userId,
          bursaryId: application.bursaryId,
          status: application.status,
          deadlineDate: application.deadlineDate,
          notes: application.notes,
          documentsSubmitted: application.documentsSubmitted,
          checklist: application.checklist,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Error creating application in Supabase:', error);
        throw new Error(`Failed to create application: ${error.message}`);
      }

      return data?.id || application.id;
    } catch (err) {
      console.error('Supabase application creation failed:', err);
      throw err;
    }
  },

  async listNotifications(userId: string): Promise<NotificationRecord[]> {
    if (!supabase) {
      console.warn('Supabase not configured, cannot sync notifications');
      return [];
    }

    if (!userId) {
      console.warn('userId is required to fetch notifications');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, userId, title, message, channel, type, entityId, dueDate, createdAt, read'
        )
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching notifications from Supabase:', error);
        return [];
      }

      return (data || []) as NotificationRecord[];
    } catch (err) {
      console.error('Supabase notifications fetch failed:', err);
      return [];
    }
  },
};
