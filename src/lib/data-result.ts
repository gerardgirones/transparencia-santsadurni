export type DataResult<T> =
  | { data: T; unavailable: false }
  | { data: null; unavailable: true };

export async function loadData<T>(label: string, load: () => Promise<T>): Promise<DataResult<T>> {
  try {
    return { data: await load(), unavailable: false };
  } catch (error) {
    console.error(`Unable to load ${label}:`, error);
    return { data: null, unavailable: true };
  }
}
