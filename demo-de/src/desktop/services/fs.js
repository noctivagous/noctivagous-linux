/* The demo file system — one data source, two readers.
 *
 * FILEDATA is the flat folder table the Files window renders.
 * fsTree() derives the nested tree the NavGraph desktop-layer app
 * renders: a row typed "Folder" whose name is itself a FILEDATA
 * key gets that folder's rows as children; any other folder is an
 * empty leaf. Folder names are unique across the table, which is
 * what makes the name-keyed derivation sound.
 */

export const FILEDATA = {
  Home: [["Documents", "—", "Folder"], ["Projects", "—", "Folder"], ["Pictures", "—", "Folder"], ["notes.txt", "2 KB", "Text"], [".profile", "1 KB", "Config"]],
  Documents: [["report-q3.txt", "18 KB", "Text"], ["budget.csv", "44 KB", "Sheet"], ["letter.txt", "3 KB", "Text"], ["archive", "—", "Folder"]],
  Projects: [["demo-de", "—", "Folder"], ["nct-ui", "—", "Folder"], ["whirlivector", "—", "Folder"], ["README.md", "6 KB", "Markdown"]],
  Pictures: [["wall-01.png", "1.2 MB", "Image"], ["wall-02.png", "980 KB", "Image"], ["capture.png", "2.4 MB", "Image"]],
};

export function fsTree() {
  const build = (name, path) => {
    const node = { name, kind: "folder", path, children: [] };
    for (const [n, size, type] of FILEDATA[name] || []) {
      if (type === "Folder") node.children.push(build(n, path + "/" + n.toLowerCase()));
      else node.children.push({ name: n, kind: "file", path: path + "/" + n, size, type });
    }
    return node;
  };
  return build("Home", "/home/noctivagous");
}
