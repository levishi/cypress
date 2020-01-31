const path = require('path')
const debug = require('debug')('cypress:server:browsers:utils')
const Bluebird = require('bluebird')
const getPort = require('get-port')
const launcher = require('@packages/launcher')
const fs = require('../util/fs')
const extension = require('@packages/extension')
const appData = require('../util/app_data')
const profileCleaner = require('../util/profile_cleaner')

const PATH_TO_BROWSERS = appData.path('browsers')
const pathToProfiles = path.join(PATH_TO_BROWSERS, '*')

const getBrowserPath = (browser) => {
  return path.join(
    PATH_TO_BROWSERS,
    `${browser.name}`
  )
}

const copyExtension = (src, dest) => {
  return fs.copyAsync(src, dest)
}

const getPartition = function (isTextTerminal) {
  if (isTextTerminal) {
    return `run-${process.pid}`
  }

  return 'interactive'
}

const getProfileDir = (browser, isTextTerminal) => {
  return path.join(
    getBrowserPath(browser),
    getPartition(isTextTerminal)
  )
}

const getExtensionDir = (browser, isTextTerminal) => {
  return path.join(
    getProfileDir(browser, isTextTerminal),
    'CypressExtension'
  )
}

const ensureCleanCache = async function (browser, isTextTerminal) {
  const p = path.join(
    getProfileDir(browser, isTextTerminal),
    'CypressCache'
  )

  await fs.removeAsync(p)
  await fs.ensureDirAsync(p)

  return p
}

// we now store profiles inside the Cypress binary folder
// so we need to remove the legacy root profiles that existed before
function removeLegacyProfiles () {
  return profileCleaner.removeRootProfile(pathToProfiles, [
    path.join(pathToProfiles, 'run-*'),
    path.join(pathToProfiles, 'interactive'),
  ])
}

const removeOldProfiles = function () {
  // a profile is considered old if it was used
  // in a previous run for a PID that is either
  // no longer active, or isnt a cypress related process
  const pathToPartitions = appData.electronPartitionsPath()

  return Bluebird.all([
    removeLegacyProfiles(),
    profileCleaner.removeInactiveByPid(pathToProfiles, 'run-'),
    profileCleaner.removeInactiveByPid(pathToPartitions, 'run-'),
  ])
}

const pathToExtension = extension.getPathToExtension()
let extensionDest = appData.path('web-extension')
let extensionBg = appData.path('web-extension', 'background.js')

export = {
  getPort,

  copyExtension,

  getProfileDir,

  getExtensionDir,

  ensureCleanCache,

  removeOldProfiles,

  getBrowserByPath: launcher.detectByPath,

  launch: launcher.launch,

  writeExtension (browser, isTextTerminal, proxyUrl, socketIoRoute, onScreencastFrame) {
    debug('writing extension')

    // debug('writing extension to chrome browser')
    // get the string bytes for the final extension file
    return extension.setHostAndPath(proxyUrl, socketIoRoute, onScreencastFrame)
    .then((str) => {
      extensionDest = getExtensionDir(browser, isTextTerminal)
      extensionBg = path.join(extensionDest, 'background.js')

      // copy the extension src to the extension dist
      return copyExtension(pathToExtension, extensionDest)
      .then(() => {
        debug('copied extension')

        // and overwrite background.js with the final string bytes
        return fs.writeFileAsync(extensionBg, str)
      }).return(extensionDest)
    })
  },

  getBrowsers () {
    debug('getBrowsers')

    return launcher.detect()
    .then((browsers = []) => {
      let majorVersion

      debug('found browsers %o', { browsers })

      // @ts-ignore
      const version = process.versions.chrome || ''

      if (version) {
        majorVersion = parseInt(version.split('.')[0])
      }

      const electronBrowser = {
        name: 'electron',
        family: 'electron',
        displayName: 'Electron',
        version,
        path: '',
        majorVersion,
        info: 'Electron is the default browser that comes with Cypress. This is the default browser that runs in headless mode. Selecting this browser is useful when debugging. The version number indicates the underlying Chromium version that Electron uses.',
      }

      // the internal version of Electron, which won't be detected by `launcher`
      debug('adding Electron browser with version %s', version)

      return browsers.concat(electronBrowser)
    })
  },
}
