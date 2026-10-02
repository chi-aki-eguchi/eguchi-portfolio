// Only a fixed service identifier travels in the URL; consultation text stays local.
export function monthlyReviewRequested(search: string, serviceOwner: boolean): boolean {
  return serviceOwner && new URLSearchParams(search).get("inquiry") === "monthly-review";
}

export function monthlyReviewSubject(language: "ja" | "en"): string {
  return language === "en" ? "Monthly site review" : "月々点検について";
}
