import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Users, KeyRound, Share2, BarChart3, ClipboardList } from 'lucide-react';
import { db, type Application } from '@/infrastructure/database/indexeddb/schema';

interface ClassroomModeProps {
  userId?: string;
  applications: Application[];
}

const makeClassCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const ClassroomMode: React.FC<ClassroomModeProps> = ({ userId, applications }) => {
  const [teacherName, setTeacherName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [studentCount, setStudentCount] = useState(0);

  const trackedCount = useMemo(
    () => applications.filter((item) => item.status !== 'draft').length,
    [applications]
  );

  const handleCreateClassroom = async () => {
    const code = makeClassCode();
    const id = uuidv4();

    await db.classrooms.put({
      id,
      code,
      teacherName: teacherName.trim() || 'Teacher',
      createdAt: new Date().toISOString(),
    });

    setClassCode(code);
    setStudentCount(0);
  };

  const handleJoinClassroom = async () => {
    if (!userId || !joinCode.trim()) return;

    const classroom = await db.classrooms.where('code').equals(joinCode.trim().toUpperCase()).first();
    if (!classroom) return;

    await db.classroomMembers.put({
      id: uuidv4(),
      classroomId: classroom.id,
      userId,
      joinedAt: new Date().toISOString(),
    });

    const members = await db.classroomMembers.where('classroomId').equals(classroom.id).toArray();
    setClassCode(classroom.code);
    setStudentCount(members.length);
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-700" /> Classroom Mode
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Create a class code for learners, or join a class using a teacher code.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Teacher Setup</h2>
          <input
            value={teacherName}
            onChange={(event) => setTeacherName(event.target.value)}
            placeholder="Teacher name"
            className="w-full px-3 py-2 rounded-lg border border-gray-300"
          />
          <button
            onClick={() => void handleCreateClassroom()}
            className="w-full px-4 py-2.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
          >
            Generate Class Code
          </button>

          {classCode ? (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs text-blue-800 font-medium">Class Code</p>
              <p className="text-2xl tracking-widest font-bold text-blue-900 mt-1 flex items-center gap-2">
                <KeyRound className="w-5 h-5" /> {classCode}
              </p>
              <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> Share this code with learners.
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Join Classroom</h2>
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Enter class code"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 uppercase"
          />
          <button
            onClick={() => void handleJoinClassroom()}
            className="w-full px-4 py-2.5 rounded-lg bg-green-700 text-white hover:bg-green-800"
          >
            Join Classroom
          </button>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> Learners joined
              </p>
              <p className="text-xl font-semibold text-gray-900">{studentCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" /> Tracked applications
              </p>
              <p className="text-xl font-semibold text-gray-900">{trackedCount}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-sm text-amber-900">
        Classroom analytics are aggregated and anonymized. Teacher view focuses on progress counts, not personal student details.
      </div>
    </div>
  );
};

export default ClassroomMode;
