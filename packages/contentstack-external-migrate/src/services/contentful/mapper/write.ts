import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

export interface MapperBundle {
  contentTypes: any[];
  taxonomies: any[];
  locales: string[];
}

/**
 * Serialize the in-memory mapper (the same shape the UI POSTs to
 * /v2/mapper/createDummyData today) into the output bundle. Users can audit
 * mapper.json after a run, and it travels with the bundle if/when the user
 * later runs `csdx cm:stacks:import`.
 */
export async function writeMapper(outputDir: string, mapper: MapperBundle): Promise<string> {
  await mkdirp(outputDir);
  const target = path.join(outputDir, 'mapper.json');
  await fs.promises.writeFile(target, JSON.stringify(mapper, null, 2), 'utf8');
  return target;
}
