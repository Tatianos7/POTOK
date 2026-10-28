# Program client acceptance on the private restored copy

The owner already confirmed `PROGRAM_FIXTURE_ROLLBACK_OK` in
`program-fixture-rehearsal-Satx5k`. That proved SQL-role behavior, not the client.
This separate step runs the unchanged production `ProgramExecutionService` using
the locked Supabase SDK and real existing-user OTP/Auth/PostgREST.

The fixed private candidate receives four explicitly synthetic programs, 24 rows,
bound to the two existing synthetic identities and the day 2199-01-15. No generator,
authority, migration, grant, policy, hosted service or application deployment changes.
The baseline backup is not changed. Cached browser-image dependencies are reused;
there is no browser build, npm install, new download or browser UI test.

Each owner reads the parent, day and masked explanation, then performs planned,
completed and skipped actions. The other account cannot read or annotate those
programs. Account changes between the two real Auth checks cause no PATCH.
Payload, date and program-version writes remain denied. The diary remains identical:
PLAN != FACT. The worker receives only the fixture manifest and ordinary OTP users;
it receives no signing secret, database URI, service-role key, bind mount or Docker socket.

After the worker, privileged cleanup first compares the entire seeded graph, allowing
only session status/reason/update timestamp differences. It then deletes only the
24 manifest IDs in dependency order, without CASCADE. Cleanup failure stops the step.
Independent checks require all fixture IDs absent, the original 112 protected tables,
current security contracts and empty authority preserved, unchanged Storage catalog
and all 63 original files. Logs, seed and cleanup SQL remain private on the Mac.
An uncertain seed/cleanup result must not be automatically replayed.

The disposable Supabase CI uses the same seed, observation, cleanup and client-check
functions. Local source guards are insufficient: the real Auth/SDK/HTTP CI gate must
pass before providing the Mac launch command. Mac success is a separate owner observation.

Entry: `program-client.mjs --run-private-program-client BASE PROGRAM_REHEARSAL_DIR`.
Success: `PRIVATE_PROGRAM_CLIENT_OK`. This does not claim program UI acceptance,
full `ProgramDeliveryService` secondary flows, production deployment or release approval.

The remaining release work is application acceptance for the agreed scope, an exact
client-first deployment/recovery packet, fresh hosted read-only drift review, owner
approval for a concrete hosted batch, and post-apply verification. The separate payment
task remains after meal-plan generation, as tracked in issue #198.
