const { buildDataset } = require('../src/data/hospital-dataset');

function sample(items, n = 5) {
  return items.slice(0, n);
}

function findDuplicates(items) {
  const seen = new Set();
  const duplicates = [];
  for (const it of items) {
    const key = `${it.pk}||${it.sk}`;
    if (seen.has(key)) duplicates.push(key);
    else seen.add(key);
  }
  return duplicates;
}

function run() {
  const items = buildDataset();
  console.log(`Dataset total items: ${items.length}`);
  console.log('\nSample items:');
  console.log(JSON.stringify(sample(items, 6), null, 2));

  const dup = findDuplicates(items);
  if (dup.length) {
    console.warn(`\nFound ${dup.length} duplicate pk+sk keys (should be unique):`);
    console.warn(dup.slice(0, 20).join('\n'));
  } else {
    console.log('\nNo duplicate pk+sk keys detected.');
  }

  // simulate batching
  const batches = Math.ceil(items.length / 25);
  console.log(`\nSimulated batch count (25/item): ${batches}`);
}

run();
