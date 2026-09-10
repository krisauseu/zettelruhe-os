// Optional proposal only. No expense backfill or change to RC/journal contracts.
migrate(app => {
  const c = app.findCollectionByNameOrId('kontakte');
  c.fields.add(new SelectField({ name: 'ausgaben_steuerstandard', maxSelect: 1,
    values: ['bisherig', 'eu_dienstleistung', 'drittland_dienstleistung'] }));
  app.save(c);
}, app => {
  const c = app.findCollectionByNameOrId('kontakte');
  c.fields.removeByName('ausgaben_steuerstandard');
  app.save(c);
});
