export interface WebDavConnectionTestInput {
  serverUrl: string;
  username: string;
  token: string;
}

export const webDavConnectionService = {
  async testConnection({
    serverUrl,
    username,
    token,
  }: WebDavConnectionTestInput): Promise<{ ok: boolean; status: number }> {
    const normalizedUrl = serverUrl.endsWith("/")
      ? serverUrl
      : `${serverUrl}/`;
    const response = await fetch(normalizedUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${window.btoa(`${username}:${token}`)}`,
        Depth: "0",
      },
    });
    return { ok: response.ok, status: response.status };
  },
};
