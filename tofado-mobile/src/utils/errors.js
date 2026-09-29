export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code === "ECONNABORTED") return "The request took too long. Check your connection and try again.";
  if (!error.response) return "We couldn't connect to the server. Check your internet connection and try again.";
  const status = error.response.status;
  const serverMessage = error.response?.data?.message;
  if (status === 401) return serverMessage || "Your session has expired. Please sign in again.";
  if (status === 403) return serverMessage || "You don't have permission to perform this action.";
  if (status === 404) return "The requested information could not be found.";
  if (status >= 500) return "Our server is temporarily unavailable. Please try again shortly.";
  return serverMessage || fallback;
}
