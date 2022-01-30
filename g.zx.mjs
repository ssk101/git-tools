#!/usr/bin/env zx

// Node >= 17.0.0 is required for readline's Promises API.

if(+process.versions.node.split('.')[0] < 17) {
  console.error(`Node version must be >= 17, your version:`, process.versions.node)
  process.exit(0)
}

$.verbose = false

const tools = {
  zx: {
    help: '$ npm i -g zx',
    required: true,
  },
  hub: {
    help: 'https://github.com/github/hub',
    required: true,
  },
}

const helpText = [
  'Requirements and installation instructions:',
  `\tzx: $ ${tools.zx.help}`,
  `\thub: ${tools.hub.help}`,
  '\Example usage:',
  '\tList your branches, ordered by commit date:',
  '\t\t$ g br',
  '\tCreate a pull request with title and description for target branch <branch>',
  '\t\t$ g pr "<title>" <branch> "[description]"',
  '\nYou can alias this script in your .bashrc or equivalent like so:',
  '\talias g="zx g.zx.mjs"',
].join('\n')

for(const tool of Object.keys(tools)) {
  if(!tool.required) continue
  await checkTool(tool)
}

const args = process.argv.slice(3)
const command = args[0]
const opts = args.slice(1) || []

const ALIASES = {
  help: ['h'],
  'my-branches': ['mb', 'mbr', 'mybr'],
  'pull-request': ['pr'],
  'stash-list': ['sl', 'stl'],
  'stash-named': ['st', 'stn'],
  'stash-pop': ['sp', 'stp'],
  'cherry-pick': ['cp'],
  checkout: ['co'],
  status: ['s'],
  commit: ['c'],
  merge: ['m'],
  pull: ['pl'],
  push: ['ps'],
  'add-all': ['aa'],
  add: ['a'],
  clean: ['cl'],
  reset: ['r'],
  'hard-reset': ['hr'],
  feature: ['feat'],
}

async function run(items, verbose = true) {
  const { stdout } = await $`${items}`

  if(verbose) {
    console.log(stdout)
  }

  return stdout
}

async function checkTool(command) {
  const tool = tools[command]
  const notFound = `${command} is not installed or is not in your environment's PATH.\n`

  if(!tool) {
    console.warn(notFound)
    return
  }

  const { required, help } = tool

  try {
    const result = await $`type ${command} &> /dev/null`
    return result.stdout === ''
  } catch (e) {
    console[required ? 'error' : 'warn'](notFound)
    console.info(help)

    if(required) {
      process.exit(0)
    }
  }
}

function missing(item) {
  console.error('Required argument', item, 'not supplied.')
  process.exit(0)
}

function camelCase(str) {
  return str
    .replace(/([A-Z])/g, (_, match) => ' ' + match.toLowerCase())
    .replace(/[_\- ]+(.)/g, ' $1')
    .trim()
    .replace(/\s(.)/g, (_, match) => match.toUpperCase())
}

async function currentBranch() {
  const branch = await run([
    'git',
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ])

  return branch.trim().replace(/\n/, '')
}

const commands = {
  help: () => {
    console.info(helpText)
    process.exit(0)
  },

  myBranches: async () => {
    await run([
      'git',
      'for-each-ref',
      '--sort=committerdate',
      'refs/heads/',
      `--format=%(HEAD) %(color:yellow)%(refname:short)%(color:reset) %(authorname) (%(color:green)%(committerdate:relative)%(color:reset))`,
      '--color',
    ])
  },

  pullRequest: async () => {
    const [title, baseBranch, description = '', browser] = opts
    if(!title || !baseBranch) {
      return missing('title and/or base branch')
    }

    const parts = [
      'hub',
      'pull-request',
      '-m',
      `${title}`,
      description.trim() ? ['-m', description] : '',
      '-b',
      baseBranch,
      browser ? '-o' : '',
    ]
      .flat()
      .filter(part => part.trim())

    await run(parts)
  },

  stashList: async () => {
    const list = await run([
      'git',
      '--no-pager',
      'stash',
      'list',
    ])

    return list
  },

  stashNamed: async () => {
    const name = (opts[0] || '').trim()

    if(!name) {
      return missing('stash name')
    }

    await run([
      'git',
      'stash',
      'push',
      '-u',
      '-m',
      name,
    ])
  },

  stashPop: async () => {
    const stdout = await this.stashList()
    const current = await currentBranch()
    const stashName = (opts[0] || '').trim()

    if(!stashName) {
      return run(['git', 'stash', 'pop', 0])
    }

    for(const [index, line] of Object.entries(stdout.split('\n'))) {
      if(!line) continue

      const matched = line.match(/(?=(stash@{\d}: On )(.*): (.*))/)

      if(!matched) continue

      const [ branch, name ] = matched.slice(2)

      if(branch === current && name === stashName) {
        await run([
          'git',
          'stash',
          'pop',
          index,
        ])
      }
    }
  },

  checkout: async () => {
    const branch = opts.filter(part => part.trim() !== '-b').pop()

    if(!branch) {
      return missing('branch or reference(s)')
    }

    const current = await currentBranch()
    const exists = (await run([
      'git',
      'branch',
      '--list',
      branch,
    ])).trim()

    const parts = [
      'git',
      'checkout',
      !exists ? '-b' : '',
      branch,
      !exists ? current : '',
    ]
      .filter(part => part)

    await run(parts)
  },

  cherryPick: async () => {
    if(!opts?.length) {
      return missing('commit reference(s)')
    }

    await run(['git', 'cherry-pick', ...opts])
  },

  status: async () => {
    await run(['git', 'status'])
  },

  commit: async () => {
    const message = opts[0]

    if(!message) {
      return missing('commit message')
    }

    await run(['git', 'commit', '-m', message])
  },

  merge: async () => {
    const source = opts[0]

    if(!source) {
      return missing('merge source')
    }

    await run(['git', 'merge', source])
  },

  pull: async () => {
    await run(['git', 'pull'])
  },

  add: async () => {
    if(!opts) {
      return missing('path(s) or glob(s)')
    }

    await run(['git', 'add', ...opts])
  },

  addAll: async () => {
    await run(['git', 'add', '-A'])
  },

  reset: async () => {
    await run(['git', 'reset'])
  },

  hardReset: async () => {
    const readline = await import('node:readline/promises')
    const { stdin: input, stdout: output } = await import('process')
    const rl = readline.createInterface({ input, output })
    const current = await currentBranch()
    const prompt = await rl.question(`Are you sure you want to hard reset the branch ${current}? (y/n)\n`)

    if(prompt.toLowerCase() !== 'y') {
      process.exit(0)
    }

    const reset = [
      'git',
      'reset',
    ]
    const checkout = [
      'git',
      'checkout',
      '.',
    ]
    const clean = [
      'git',
      'clean',
      '-fd',
    ]
    const fetch = [
      'git',
      'fetch',
    ]
    const hardReset = [
      'git',
      'reset',
      '--hard',
      `origin/${current}`
    ]

    await run(reset)
    await run(checkout)
    await run(clean)
    await run(fetch)
    await run(hardReset)
  },

  clean: async () => {
    await run(['git', 'clean', '-fd'])
  },

  push: async () => {
    const current = await currentBranch()
    await run(['git', 'push', '-u', 'origin', current])
  },
}

const cmd = Object.keys(ALIASES).find(key => ALIASES[key].includes(command))

if(!cmd) {
  const list = Object.keys(ALIASES)
    .map(key => `${key}: ${ALIASES[key].join(' | ')}`)
    .join('\n ')
  console.error('Command alias not found, available aliases:\n\n', list, '\n')
} else {
  const fn = commands[camelCase(cmd)]
  if(!fn) {
    console.log(cmd, 'command is not yet implemented.')
  } else {
    const result = await commands[camelCase(cmd)]()
  }
}

process.exit(0)
