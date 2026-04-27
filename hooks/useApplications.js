import { useState, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseProvider';

export function useApplications(userId = 'current-user') {
  const { applicationRepo } = useDatabase();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApplications = async () => {
    setLoading(true);
    const data = await applicationRepo.getUserApplications(userId);
    setApplications(data);
    setLoading(false);
  };

  useEffect(() => {
    loadApplications();
  }, [userId]);

  const addApplication = async (bursaryId, deadlineDate) => {
    await applicationRepo.add({
      userId,
      bursaryId,
      deadlineDate,
      status: 'planning',
      appliedDate: new Date().toISOString()
    });
    await loadApplications();
  };

  const updateStatus = async (id, status) => {
    await applicationRepo.updateStatus(id, status);
    await loadApplications();
  };

  return { applications, loading, addApplication, updateStatus, refresh: loadApplications };
}