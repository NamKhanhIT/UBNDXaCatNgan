'use client';

import React from 'react';
import { CalendarFeature } from '../../../features/calendar/CalendarFeature';

export default function CalendarPage() {
  return <React.Suspense fallback={<p>Đang tải lịch…</p>}><CalendarFeature /></React.Suspense>;
}
