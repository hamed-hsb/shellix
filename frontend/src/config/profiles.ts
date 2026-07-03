// Saved connection profiles, persisted by the Go backend as profiles.json. The
// schema is owned here; the backend stores each entry opaquely.

import type { SessionSpec } from '../backend/api';
import { GetProfiles, SaveProfiles } from '../../wailsjs/go/main/App';

export interface Profile {
    id: string;
    name: string;
    spec: SessionSpec;
}

export async function loadProfiles(): Promise<Profile[]> {
    try {
        const raw = (await GetProfiles()) as Profile[] | null;
        return Array.isArray(raw) ? raw.filter((p) => p && p.spec && p.name) : [];
    } catch (err) {
        console.error('failed to load profiles:', err);
        return [];
    }
}

export async function persistProfiles(list: Profile[]): Promise<void> {
    try {
        await SaveProfiles(list as unknown as Array<Record<string, unknown>>);
    } catch (err) {
        console.error('failed to save profiles:', err);
    }
}
