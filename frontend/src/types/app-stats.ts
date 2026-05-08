/** `GET /api/v1/apps/{id}/stats` — günlük yorum hacmi. */

export type ReviewVolumePointDto = {
  date: string;
  count: number;
};

export type AppReviewVolumeStatsDto = {
  points: ReviewVolumePointDto[];
};
