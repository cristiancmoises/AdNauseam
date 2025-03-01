/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2014-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* global uDom */

'use strict';

/******************************************************************************/

/* note: not used by AdNauseam */

(function() {

'use strict';

/******************************************************************************/

const handleImportFilePicker = function() {
    const file = this.files[0];
    if ( file === undefined || file.name === '' ) { return; }
    if ( file.type.indexOf('text') !== 0 ) { return; }

    const filename = file.name;

    const fileReaderOnLoadHandler = function() {
        let userData;
        try {
            userData = JSON.parse(this.result);
            if ( typeof userData !== 'object' ) {
                throw 'Invalid';
            }
            if ( typeof userData.userSettings !== 'object' ) {
                throw 'Invalid';
            }
            if (
                Array.isArray(userData.whitelist) === false &&
                typeof userData.netWhitelist !== 'string'
            ) {
                throw 'Invalid';
            }
            if (
                typeof userData.filterLists !== 'object' &&
                Array.isArray(userData.selectedFilterLists) === false
            ) {
                throw 'Invalid';
            }
        }
        catch (e) {
            userData = undefined;
        }
        if ( userData === undefined ) {
            window.alert(vAPI.i18n('aboutRestoreDataError').replace(/uBlock₀/g, 'AdNauseam'));
            return;
        }
        const time = new Date(userData.timeStamp);
        const msg = vAPI.i18n('aboutRestoreDataConfirm')
                        .replace('{{time}}', time.toLocaleString());
        const proceed = window.confirm(msg);
        if ( proceed !== true ) { return; }
        vAPI.messaging.send('dashboard', {
            what: 'restoreUserData',
            userData,
            file: filename,
        });
    };

    const fr = new FileReader();
    fr.onload = fileReaderOnLoadHandler;
    fr.readAsText(file);
};

/******************************************************************************/

const startImportFilePicker = function() { // ADN, stay inside settings.js
    const input = document.getElementById('restoreFilePicker');
    // Reset to empty string, this will ensure an change event is properly
    // triggered if the user pick a file, even if it is the same as the last
    // one picked.
    input.value = '';
    input.click();
};

/******************************************************************************/

const exportToFile = async function() {
    const response = await vAPI.messaging.send('dashboard', {
        what: 'backupUserData',
    });
    if (
        response instanceof Object === false ||
        response.userData instanceof Object === false
    ) {
        return;
    }
    vAPI.download({
        'url': 'data:text/plain;charset=utf-8,' +
               encodeURIComponent(JSON.stringify(response.userData, null, '  ')),
        'filename': response.localData.lastBackupFile
    });
    onLocalDataReceived(response.localData);
};

/******************************************************************************/

const onLocalDataReceived = function(details) {
    let v, unit;
    if ( typeof details.storageUsed === 'number' ) {
        v = details.storageUsed;
        if ( v < 1e3 ) {
            unit = 'genericBytes';
        } else if ( v < 1e6 ) {
            v /= 1e3;
            unit = 'KB';
        } else if ( v < 1e9 ) {
            v /= 1e6;
            unit = 'MB';
        } else {
            v /= 1e9;
            unit = 'GB';
        }
    } else {
        v = '?';
        unit = '';
    }
    uDom.nodeFromId('storageUsed').textContent =
        vAPI.i18n('storageUsed')
            .replace('{{value}}', v.toLocaleString(undefined, { maximumSignificantDigits: 3 }))
            .replace('{{unit}}', unit && vAPI.i18n(unit) || '')
            .replace(/uBlock₀/g, 'AdNauseam');

    const timeOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short'
    };

    const lastBackupFile = details.lastBackupFile || '';
    if ( lastBackupFile !== '' ) {
        const dt = new Date(details.lastBackupTime);
        const text = vAPI.i18n('settingsLastBackupPrompt');
        const node = uDom.nodeFromId('settingsLastBackupPrompt');
        node.textContent = text + '\xA0' + dt.toLocaleString('fullwide', timeOptions);
        node.style.display = '';
    }

    const lastRestoreFile = details.lastRestoreFile || '';
    if ( lastRestoreFile !== '' ) {
        const dt = new Date(details.lastRestoreTime);
        const text = vAPI.i18n('settingsLastRestorePrompt');
        const node = uDom.nodeFromId('settingsLastRestorePrompt');
        node.textContent = text + '\xA0' + dt.toLocaleString('fullwide', timeOptions);
        node.style.display = '';
    }

    if ( details.cloudStorageSupported === false ) {
        uDom('[data-setting-name="cloudStorageEnabled"]').attr('disabled', '');
    }

    if ( details.privacySettingsSupported === false ) {
        uDom('[data-setting-name="prefetchingDisabled"]').attr('disabled', '');
        uDom('[data-setting-name="hyperlinkAuditingDisabled"]').attr('disabled', '');
        uDom('[data-setting-name="webrtcIPAddressHidden"]').attr('disabled', '');
    }
};

/******************************************************************************/

const resetUserData = function() {
    var msg = vAPI.i18n('adnAboutResetDataConfirm');
    const proceed = window.confirm(msg);
    if ( proceed !== true ) { return; }
    vAPI.messaging.send('dashboard', {
        what: 'resetUserData',
    });
};

/******************************************************************************/

const synchronizeDOM = function() {
    document.body.classList.toggle(
        'advancedUser',
        uDom.nodeFromSelector('[data-setting-name="advancedUserEnabled"]').checked === true
    );
};

/******************************************************************************/

const changeUserSettings = function(name, value) {
    vAPI.messaging.send('dashboard', {
        what: 'userSettings',
        name,
        value,
    });
};

/******************************************************************************/

const onInputChanged = function(ev) {
    const input = ev.target;
    const name = this.getAttribute('data-setting-name');
    let value = input.value;
    if ( name === 'largeMediaSize' ) {
        value = Math.min(Math.max(Math.floor(parseInt(value, 10) || 0), 0), 1000000);
    }
    if ( value !== input.value ) {
        input.value = value;
    }
    changeUserSettings(name, value);
};

/******************************************************************************/

// Workaround for:
// https://github.com/gorhill/uBlock/issues/1448

const onPreventDefault = function(ev) {
    ev.target.focus();
    ev.preventDefault();
};

/******************************************************************************/

// TODO: use data-* to declare simple settings

const onUserSettingsReceived = function(details) {
    const checkboxes = document.querySelectorAll('[data-setting-type="bool"]');
    for ( const checkbox of checkboxes ) {
        const name = checkbox.getAttribute('data-setting-name') || '';
        if ( details[name] === undefined ) {
            checkbox.closest('.checkbox').setAttribute('disabled', '');
            checkbox.setAttribute('disabled', '');
            continue;
        }
        checkbox.checked = details[name] === true;
        checkbox.addEventListener('change', ( ) => {
            changeUserSettings(name, checkbox.checked);
            synchronizeDOM();
        });
    }

    if ( details.canLeakLocalIPAddresses === true ) {
        uDom('[data-setting-name="webrtcIPAddressHidden"]')
            .ancestors('div.li')
            .css('display', '');
    }

    uDom('[data-i18n="settingsNoLargeMediaPrompt"] > input[type="number"]')
        .attr('data-setting-name', 'largeMediaSize')
        .attr('data-setting-type', 'input');

    uDom('[data-setting-type="input"]').forEach(function(uNode) {
        uNode.val(details[uNode.attr('data-setting-name')])
             .on('change', onInputChanged)
             .on('click', onPreventDefault);
    });

    uDom('#export').on('click', ( ) => { exportToFile(); });
    uDom('#import').on('click', startImportFilePicker);
    uDom('#reset').on('click', resetUserData);
    uDom('#restoreFilePicker').on('change', handleImportFilePicker);

    synchronizeDOM();
};

/******************************************************************************/

vAPI.messaging.send('dashboard', { what: 'userSettings' }).then(result => {
    onUserSettingsReceived(result);
});

vAPI.messaging.send('dashboard', { what: 'getLocalData' }).then(result => {
    onLocalDataReceived(result);
});

// https://github.com/uBlockOrigin/uBlock-issues/issues/591
document.querySelector(
    '[data-i18n-title="settingsAdvancedUserSettings"]'
).addEventListener(
    'click',
    self.uBlockDashboard.openOrSelectPage
);

/******************************************************************************/

})();
