import { collect } from '../server/collector.mjs'
const index = process.argv.indexOf('--interval')
const minutes = index < 0 ? 0 : Math.max(5, Number(process.argv[index + 1]) || 30)
async function run() {
  const result = await collect({ force: true })
  console.log(
    JSON.stringify(
      {
        collectedAt: result.collectedAt,
        logs: result.logs,
        failures: result.failures,
        records: result.sources.reduce((sum, source) => sum + source.count, 0),
      },
      null,
      2,
    ),
  )
  if (!result.sources.length && !minutes) process.exitCode = 1
}
await run()
if (minutes)
  setInterval(() => {
    void run()
  }, minutes * 60000)
