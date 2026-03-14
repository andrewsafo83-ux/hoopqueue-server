import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

export type AnalyticsEvent =
  | "app_open"
  | "profile_saved"
  | "court_view"
  | "player_checkin"
  | "waitlist_join"
  | "waitlist_leave"
  | "post_created"
  | "post_liked"
  | "comment_added"
  | "dm_sent"
  | "friend_request_sent"
  | "friend_request_accepted"
  | "search_performed"
  | "photo_uploaded";

export function track(
  event: AnalyticsEvent,
  userId?: string | null,
  properties?: Record<string, any>
): void {
  try {
    const url = new URL("/api/analytics", getApiUrl()).toString();
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        userId: userId ?? null,
        properties: properties ?? {},
        platform: Platform.OS,
      }),
    }).catch(() => {});
  } catch {}
}
