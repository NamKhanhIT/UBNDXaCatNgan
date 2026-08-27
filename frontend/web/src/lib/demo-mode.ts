// BẢO MẬT (Audit M6): Cờ demo tập trung duy nhất của frontend (dữ liệu mẫu bị loại khỏi production bundle)
export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
