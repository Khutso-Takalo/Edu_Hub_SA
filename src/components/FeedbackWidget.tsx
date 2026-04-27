import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/infrastructure/database/indexeddb/schema';

interface FeedbackWidgetProps {
  userId?: string;
}

export function FeedbackWidget({ userId }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = feedback.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await db.feedbackEntries.put({
        id: uuidv4(),
        userId,
        message: trimmed,
        context: window.location.pathname,
        createdAt: new Date().toISOString(),
      });

      setSubmitted(true);
      setFeedback('');

      window.setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-auto max-w-full flex flex-col items-end">
      <div className={"w-full sm:w-80"}>
        {open ? (
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-lg border w-full max-w-xs sm:max-w-none">
            <p className="font-medium mb-2">Help us improve EduHub</p>
            <Textarea
              placeholder="What's working? What's not?"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              className="mb-2"
            />
            {submitted ? <p className="text-xs text-green-700 mb-2">Thanks. Feedback recorded.</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!feedback.trim() || submitting}>
                Send
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setOpen(true)} className="rounded-full shadow-lg">
            Feedback
          </Button>
        )}
      </div>
    </div>
  );
}
