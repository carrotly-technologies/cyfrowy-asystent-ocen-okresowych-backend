import type { NotificationType } from './reminders.rules.js';

export interface AppNotification {
  id: string;
  userId: string;
  key: string;
  caseId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  createdOn: string;
  createdAt: string;
  readAt: string | null;
}
