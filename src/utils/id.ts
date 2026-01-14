export function generateId(): string {
    try {

        if (typeof crypto !== 'undefined' && crypto.randomUUID) {

            return crypto.randomUUID();
        }
    } catch { }
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}


