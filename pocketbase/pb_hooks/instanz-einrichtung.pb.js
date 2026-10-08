routerAdd('POST', '/internal/zettelruhe/einrichtung/v1/abschliessen', e => require(__hooks + '/instanz-einrichtung.js').route(e), $apis.requireSuperuserAuth());
onRecordCreate(e => require(__hooks + '/instanz-einrichtung.js').markerCreate(e), 'instanz_einrichtung');
onRecordUpdate(e => require(__hooks + '/instanz-einrichtung.js').markerUpdate(e), 'instanz_einrichtung');
onRecordDelete(e => require(__hooks + '/instanz-einrichtung.js').markerDelete(e), 'instanz_einrichtung');
