import isElectron from 'is-electron';
import debounce from 'lodash/debounce';
import difference from 'lodash/difference';
import get from 'lodash/get';
import set from 'lodash/set';
import merge from 'lodash/merge';
import uniq from 'lodash/uniq';
import semver from 'semver';
import settings from '../config/settings';
import ImmutableStore from '../lib/immutable-store';
import ensureArray from '../lib/ensure-array';
import log from '../lib/log';
import defaultState from './defaultState';

const store = new ImmutableStore(defaultState);

let userData = null;

// Check whether the code is running in Electron renderer process
if (isElectron()) {
    const electron = window.require('electron');
    const path = window.require('path'); // Require the path module within Electron
    const app = electron.remote.app;
    userData = {
        path: path.join(app.getPath('userData'), 'cnc.json')
    };
}

const getConfig = () => {
    let content = '';

    // Check whether the code is running in Electron renderer process
    if (isElectron()) {
        const fs = window.require('fs'); // Require the fs module within Electron
        if (fs.existsSync(userData.path)) {
            content = fs.readFileSync(userData.path, 'utf8') || '{}';
        }
    } else {
        content = localStorage.getItem('cnc') || '{}';
    }

    return content;
};

const persist = (data) => {
    const { version, state } = { ...data };

    data = {
        version: version || settings.version,
        state: {
            ...store.state,
            ...state
        }
    };

    try {
        const value = JSON.stringify(data, null, 2);

        // Check whether the code is running in Electron renderer process
        if (isElectron()) {
            const fs = window.require('fs'); // Use window.require to require fs module in Electron
            fs.writeFileSync(userData.path, value);
        } else {
            localStorage.setItem('cnc', value);
        }
    } catch (e) {
        log.error(e);
    }
};

const normalizeState = (state) => {
    // Keep default widgets unchanged
    const defaultList = get(defaultState, 'workspace.container.default.widgets');
    set(state, 'workspace.container.default.widgets', defaultList);

    // Update primary widgets
    let primaryList = get(cnc.state, 'workspace.container.primary.widgets');
    if (primaryList) {
        set(state, 'workspace.container.primary.widgets', primaryList);
    } else {
        primaryList = get(state, 'workspace.container.primary.widgets');
    }

    // Update secondary widgets
    let secondaryList = get(cnc.state, 'workspace.container.secondary.widgets');
    if (secondaryList) {
        set(state, 'workspace.container.secondary.widgets', secondaryList);
    } else {
        secondaryList = get(state, 'workspace.container.secondary.widgets');
    }

    primaryList = uniq(ensureArray(primaryList)); // Use the same order in primaryList
    primaryList = difference(primaryList, defaultList); // Exclude defaultList

    secondaryList = uniq(ensureArray(secondaryList)); // Use the same order in secondaryList
    secondaryList = difference(secondaryList, primaryList); // Exclude primaryList
    secondaryList = difference(secondaryList, defaultList); // Exclude defaultList

    set(state, 'workspace.container.primary.widgets', primaryList);
    set(state, 'workspace.container.secondary.widgets', secondaryList);

    return state;
};

const cnc = {
    version: settings.version,
    state: {}
};

try {
    const text = getConfig();
    const data = JSON.parse(text);
    cnc.version = get(data, 'version', settings.version);
    cnc.state = get(data, 'state', {});
} catch (e) {
    set(settings, 'error.corruptedWorkspaceSettings', true);
    log.error(e);
}

store.state = normalizeState(merge({}, defaultState, cnc.state || {}));

// Debouncing enforces that a function not be called again until a certain amount of time (e.g. 100ms) has passed without it being called.
store.on('change', debounce((state) => {
    persist({ state: state });
}, 100));

//
// Migration
//
const migrateStore = () => {
    if (!cnc.version) {
        return;
    }

    // 1.9.0
    // * Renamed "widgets.probe.tlo" to "widgets.probe.touchPlateHeight"
    // * Removed "widgets.webcam.scale"
    if (semver.lt(cnc.version, '1.9.0')) {
        // Probe widget
        const tlo = store.get('widgets.probe.tlo');
        if (tlo !== undefined) {
            store.set('widgets.probe.touchPlateHeight', Number(tlo));
            store.unset('widgets.probe.tlo');
        }

        // Webcam widget
        store.unset('widgets.webcam.scale');
    }
};

try {
    migrateStore();
} catch (err) {
    log.error(err);
}

store.getConfig = getConfig;
store.persist = persist;

export default store;
