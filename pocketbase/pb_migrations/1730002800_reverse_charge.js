// Additive RC v1: no backfill, classification or changes to ordinary invoice amounts.
migrate(app => {
  for (const name of ['belege', 'buchungsjournal']) {
    const c = app.findCollectionByNameOrId(name);
    c.fields.add(new JSONField({ name: 'rc', maxSize: 12000 }));
    c.fields.add(new TextField({ name: 'rc_steuerdatum', max: 10 }));
    c.fields.add(new TextField({ name: 'rc_vorgang', max: 160 }));
    c.indexes.push('CREATE INDEX idx_' + name + '_rc_datum ON ' + name + ' (firma, rc_steuerdatum) WHERE rc_steuerdatum != ""');
    c.indexes.push('CREATE INDEX idx_' + name + '_rc_vorgang ON ' + name + ' (firma, rc_vorgang) WHERE rc_vorgang != ""');
    app.save(c);
  }
}, () => {
  // No destructive downgrade of immutable tax snapshots. Restore only deliberately.
});
