import watcher from '@parcel/watcher';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 *
 * @param projectDirectory {string} Where the users project is located
 * @param catalogDirectory {string} Where the catalog code is located.
 */
export async function watch(projectDirectory: string, catalogDirectory: string): Promise<{ unsubscribe: () => Promise<void> }> {
  const contentPath = path.join(catalogDirectory, 'src', 'content');

  const watchList = ['domains', 'commands', 'events', 'services', 'teams', 'users', 'pages', 'components', 'flows'];
  // const absoluteWatchList = watchList.map((item) => path.join(projectDirectory, item));

  // confirm folders exist before watching them
  const verifiedWatchList = watchList.filter((item) => fs.existsSync(path.join(projectDirectory, item)));

  const extensionReplacer = (collection: string, file: string) => {
    if (collection === 'teams' || collection == 'users') return file;
    return file.replace('.md', '.mdx');
  };

  const subscriptions: Array<watcher.AsyncSubscription> = [];

  for (let item of [...verifiedWatchList]) {
    // Listen to the users directory for any changes.
    const sub = await watcher.subscribe(path.join(projectDirectory, item), (err, events) => {
      if (err) {
        return;
      }
      for (let event of events) {
        const { path: eventPath, type } = event;
        const file = eventPath.split(item)[1];
        let newPath = path.join(contentPath, item, extensionReplacer(item, file));

        // Check if changlogs, they need to go into their own content folder
        if (file.includes('changelog.md')) {
          newPath = newPath.replace('src/content', 'src/content/changelogs');
          if (os.platform() == 'win32') {
            newPath = newPath.replace('src\\content', 'src\\content\\changelogs');
          }
        }

        // Check if its a component, need to move to the correct location
        if (newPath.includes('components')) {
          newPath = newPath.replace('src/content/components', 'src/custom-defined-components');
          if (os.platform() == 'win32') {
            newPath = newPath.replace('src\\content\\components', 'src\\custom-defined-components');
          }
        }

        // If config files have changes
        if (eventPath.includes('eventcatalog.config.js') || eventPath.includes('eventcatalog.styles.css')) {
          fs.cpSync(eventPath, path.join(catalogDirectory, file));
          return;
        }

        // If markdown files or astro files copy file over to the required location
        if ((eventPath.endsWith('.md') || eventPath.endsWith('.astro')) && type === 'update') {
          fs.cpSync(eventPath, newPath);
        }

        // IF directory remove it
        if (type === 'delete') {
          fs.rmSync(newPath);
        }
      }
    });

    subscriptions.push(sub);
  }

  return {
    unsubscribe: async () => {
      for (const subscription of subscriptions) await subscription.unsubscribe();
    },
  };
}