import report from "../../api/report.mjs";

export function onRequest({ request, env }) {
  return report.fetch(request, env);
}
