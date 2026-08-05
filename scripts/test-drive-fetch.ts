async function testDrive() {
  const folderIds = {
    Root: "1u5dYjHeg4FnRl0HDwKJPKWxyE3sEN5RY",
    Junho: "1dhogH-8J8RpID6NNU-dbY58xInDkyyX5",
    Julho: "1k-zx56jOzlIfMuKir_0K388c5mQF-MjM",
    Agosto: "1C77k-tUwxQXsKTyQ6VRByNa7yEmk9HZT",
  };

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  for (const [label, id] of Object.entries(folderIds)) {
    const url = `https://drive.google.com/embeddedfolderview?id=${id}#list`;
    console.log(`\nTesting ${label} (${id})...`);
    try {
      const res = await fetch(url, { headers });
      console.log(`Status: ${res.status} ${res.statusText}`);
      if (!res.ok) continue;
      const html = await res.text();
      console.log(`HTML length: ${html.length}`);

      const files: Array<{ id: string; name: string }> = [];
      const re = /id="entry-([-_A-Za-z0-9]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        files.push({ id: m[1], name: m[2].trim() });
      }
      console.log(`Found ${files.length} items in ${label}:`);
      for (const f of files.slice(0, 10)) {
        console.log(`  - [${f.id}] ${f.name}`);
      }
    } catch (err: any) {
      console.error(`Error in ${label}:`, err?.message || err);
    }
  }
}

testDrive().catch(console.error);
