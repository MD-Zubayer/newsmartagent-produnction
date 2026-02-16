import { cookies } from "next/headers";

export async function getCookieString() {
  const store = await cookies();

  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}
