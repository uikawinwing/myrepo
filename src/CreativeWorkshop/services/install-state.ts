import { creativeWorkshopDiag, creativeWorkshopDiagError } from './diagnostic-log';
import {
  getCreativeWorkshopBoundWorldbookNames,
  getCreativeWorkshopInstallRecords,
  getCreativeWorkshopRelevantWorldbookNames,
} from './install-registry';
import { getCreativeWorkshopRegexId } from './regex-name';

export type CreativeWorkshopInstalledProject = {
  projectId: string;
  name: string;
  legacyProjectName: string | null;
  localVersion: string | null;
  remoteVersion: string | null;
  entryCount: number;
  regexCount: number;
  canUpdate: boolean;
  hasUpdate: boolean;
  worldbookName: string | null;
};

export type CreativeWorkshopInstalledProjectScan = {
  projects: CreativeWorkshopInstalledProject[];
  complete: boolean;
  unreadableWorldbookNames: string[];
};

type WorldbookScanRow = {
  worldbookName: string;
  entries: WorldbookEntry[];
  readable: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readWorldbookEntries(worldbookName: string, boundNames: Set<string>): Promise<WorldbookScanRow> {
  if (!getWorldbookNames().includes(worldbookName)) {
    if (!boundNames.has(worldbookName)) {
      creativeWorkshopDiag('install-state:stale-registry-worldbook', { worldbookName });
      return { worldbookName, entries: [], readable: true };
    }
    creativeWorkshopDiag('install-state:worldbook-not-ready', { worldbookName });
    return { worldbookName, entries: [], readable: false };
  }

  try {
    return { worldbookName, entries: await getWorldbook(worldbookName), readable: true };
  } catch (error) {
    creativeWorkshopDiagError('install-state:worldbook-read-error', {
      worldbookName,
      error: error instanceof Error ? error.message : String(error),
    });
    return { worldbookName, entries: [], readable: false };
  }
}

async function refreshWorldbookReadiness() {
  const tavernContext = (SillyTavern as any).getContext?.() || SillyTavern;
  try {
    await tavernContext.updateWorldInfoList?.();
  } catch (error) {
    creativeWorkshopDiagError('install-state:worldbook-list-refresh-error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readRelevantWorldbooksWithRetry(): Promise<WorldbookScanRow[]> {
  const initialNames = getCreativeWorkshopRelevantWorldbookNames();
  const initialBoundNames = new Set(getCreativeWorkshopBoundWorldbookNames());
  const firstRows = await Promise.all(
    initialNames.map(worldbookName => readWorldbookEntries(worldbookName, initialBoundNames)),
  );
  const unreadableNames = firstRows.filter(row => !row.readable).map(row => row.worldbookName);
  if (unreadableNames.length === 0) return firstRows;

  creativeWorkshopDiag('install-state:worldbook-refresh', { unreadableWorldbookNames: unreadableNames });
  await refreshWorldbookReadiness();

  const refreshedNames = _.uniq([...initialNames, ...getCreativeWorkshopRelevantWorldbookNames()]);
  const refreshedBoundNames = new Set(getCreativeWorkshopBoundWorldbookNames());
  const readableRowsByName = new Map(firstRows.filter(row => row.readable).map(row => [row.worldbookName, row]));
  return Promise.all(
    refreshedNames.map(
      worldbookName => readableRowsByName.get(worldbookName) || readWorldbookEntries(worldbookName, refreshedBoundNames),
    ),
  );
}

export async function scanInstalledCreativeWorkshopProjects(): Promise<CreativeWorkshopInstalledProjectScan> {
  const registry = getCreativeWorkshopInstallRecords();
  const worldbookNames = getCreativeWorkshopRelevantWorldbookNames();

  creativeWorkshopDiag('install-state:scan:start', {
    registryProjectIds: Object.keys(registry),
    worldbookNames,
  });

  const worldbookRows = await readRelevantWorldbooksWithRetry();
  const unreadableWorldbookNames = worldbookRows.filter(row => !row.readable).map(row => row.worldbookName);
  const worldbooks = worldbookRows.filter(row => row.readable);

  worldbooks.forEach(({ worldbookName, entries }) => {
    const workshopEntryCount = entries.filter(
      entry => _.isString(_.get(entry, 'extra.cw_project_id')) || _.isString(_.get(entry, 'extra.fate_project_name')),
    ).length;
    const suspiciousIdentitylessCount = entries.filter(entry => {
      const name = String(_.get(entry, 'name', ''));
      const hasWorkshopIdentity =
        _.isString(_.get(entry, 'extra.cw_project_id')) || _.isString(_.get(entry, 'extra.fate_project_name'));
      return !hasWorkshopIdentity && (name.startsWith('[DLC]') || name.startsWith('命定系统-'));
    }).length;
    if (workshopEntryCount === 0 && suspiciousIdentitylessCount === 0) return;
    creativeWorkshopDiag('install-state:worldbook', {
      worldbookName,
      totalEntries: entries.length,
      workshopEntryCount,
      suspiciousIdentitylessCount,
    });
  });

  const entryRows = worldbooks.flatMap(({ worldbookName, entries }) =>
    entries
      .filter(
        entry => _.isString(_.get(entry, 'extra.cw_project_id')) || _.isString(_.get(entry, 'extra.fate_project_name')),
      )
      .map(entry => ({ worldbookName, entry })),
  );
  const groupedEntries = _.groupBy(entryRows, row =>
    String(_.get(row.entry, 'extra.cw_project_id') || _.get(row.entry, 'extra.fate_project_name')),
  );

  const regexes = getTavernRegexes({ scope: 'character', enable_state: 'all' });
  const groupedRegexes = _.groupBy(
    regexes.filter(regex => getCreativeWorkshopRegexId(regex).startsWith('creative_workshop:')),
    regex => getCreativeWorkshopRegexId(regex).split(':')[1] || '',
  );

  const projects = _.uniq([...Object.keys(groupedEntries), ...Object.keys(groupedRegexes)])
    .filter(Boolean)
    .map(projectId => {
      const projectRows = groupedEntries[projectId] || [];
      const projectEntries = projectRows.map(row => row.entry);
      const projectRegexes = groupedRegexes[projectId] || [];
      const firstEntry = projectEntries[0];
      const firstRegex = projectRegexes[0];
      const localVersion = firstEntry ? _.get(firstEntry, 'extra.cw_project_version', null) : null;
      const legacyProjectName =
        projectEntries
          .map(entry => _.get(entry, 'extra.fate_project_name'))
          .find(value => _.isString(value) && Boolean(value)) ||
        (!UUID_PATTERN.test(projectId) ? projectId : null);
      return {
        projectId,
        name: firstEntry
          ? _.get(firstEntry, 'extra.cw_project_name_display', legacyProjectName || _.get(firstEntry, 'name', '未命名项目'))
          : legacyProjectName || _.get(firstRegex, 'script_name', '未命名项目'),
        legacyProjectName,
        localVersion,
        remoteVersion: null,
        entryCount: projectEntries.length,
        regexCount: projectRegexes.length,
        canUpdate: false,
        hasUpdate: false,
        worldbookName: registry[projectId]?.worldbookName || projectRows[0]?.worldbookName || null,
      } satisfies CreativeWorkshopInstalledProject;
    });

  const detectedProjectIds = new Set(projects.map(project => project.projectId));
  Object.entries(registry).forEach(([projectId, record]) => {
    if (detectedProjectIds.has(projectId)) return;
    const recordedWorldbook = worldbooks.find(({ worldbookName }) => worldbookName === record.worldbookName);
    const recordedEntries = recordedWorldbook?.entries || [];
    const identityMatchCount = recordedEntries.filter(
      entry =>
        _.get(entry, 'extra.cw_project_id') === projectId || _.get(entry, 'extra.fate_project_name') === projectId,
    ).length;
    const identitylessDlcCount = recordedEntries.filter(entry => {
      const name = String(_.get(entry, 'name', ''));
      const hasWorkshopIdentity =
        _.isString(_.get(entry, 'extra.cw_project_id')) || _.isString(_.get(entry, 'extra.fate_project_name'));
      return !hasWorkshopIdentity && (name.startsWith('[DLC]') || name.startsWith('命定系统-'));
    }).length;
    creativeWorkshopDiag('install-state:registry-missing-identity', {
      projectId,
      recordedWorldbookName: record.worldbookName,
      recordedWorldbookWasScanned: Boolean(recordedWorldbook),
      recordedWorldbookEntryCount: recordedWorldbook?.entries.length ?? null,
      identityMatchCount,
      identitylessDlcCount,
    });
  });

  projects.forEach(project => creativeWorkshopDiag('install-state:project', ({
    projectId: project.projectId,
    name: project.name,
    legacyProjectName: project.legacyProjectName,
    localVersion: project.localVersion,
    entryCount: project.entryCount,
    regexCount: project.regexCount,
    worldbookName: project.worldbookName,
  })));
  const complete = unreadableWorldbookNames.length === 0;
  creativeWorkshopDiag('install-state:scan:complete', {
    detectedProjectCount: projects.length,
    detectedProjectIds: projects.map(project => project.projectId),
    complete,
    unreadableWorldbookNames,
  });
  return { projects, complete, unreadableWorldbookNames };
}

export async function listInstalledCreativeWorkshopProjects(): Promise<CreativeWorkshopInstalledProject[]> {
  return (await scanInstalledCreativeWorkshopProjects()).projects;
}
