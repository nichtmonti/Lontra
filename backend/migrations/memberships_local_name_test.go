package migrations

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// TestMembershipsLocalName: an existing membership starts with no private
// name, the down migration drops it with the columns, and memberships stays
// without an update rule throughout ([D-08], [D-360]).
func TestMembershipsLocalName(t *testing.T) {
	app := newMigratedApp(t)
	if err := membershipsLocalNameDown(app); err != nil {
		t.Fatalf("prepare pre-migration schema: %v", err)
	}

	sqlExec(t, app, `INSERT INTO lists (id, name, created, updated) VALUES ('listln', 'Zuhause', '2026-01-01 00:00:00.000Z', '2026-01-01 00:00:00.000Z')`)
	sqlExec(t, app, `INSERT INTO memberships (id, account, list, created, updated) VALUES ('mln', 'acct1', 'listln', '2026-01-01 00:00:00.000Z', '2026-01-01 00:00:00.000Z')`)
	if err := membershipsLocalNameUp(app); err != nil {
		t.Fatalf("up: %v", err)
	}

	memberships, err := app.FindCollectionByNameOrId("memberships")
	if err != nil {
		t.Fatal(err)
	}
	if memberships.Fields.GetByName("local_name") == nil || memberships.Fields.GetByName("local_name_revision") == nil {
		t.Fatal("private name fields missing after the migration")
	}
	if memberships.UpdateRule != nil {
		t.Errorf("memberships.UpdateRule = %q after up, want nil", *memberships.UpdateRule)
	}
	rec, err := app.FindRecordById("memberships", "mln")
	if err != nil {
		t.Fatal(err)
	}
	if got := rec.GetString("local_name"); got != "" {
		t.Errorf("local_name = %q on an untouched membership, want empty (inherit lists.name)", got)
	}
	// The shared name is untouched by the migration.
	if got := listName(t, app, "listln"); got != "Zuhause" {
		t.Errorf("lists.name = %q, want %q", got, "Zuhause")
	}
	rec.Set("local_name", "Privat")
	if err := app.SaveNoValidate(rec); err != nil {
		t.Fatalf("save override: %v", err)
	}

	if err := membershipsLocalNameDown(app); err != nil {
		t.Fatalf("down: %v", err)
	}
	memberships, err = app.FindCollectionByNameOrId("memberships")
	if err != nil {
		t.Fatal(err)
	}
	if memberships.Fields.GetByName("local_name") != nil || memberships.Fields.GetByName("local_name_revision") != nil {
		t.Error("private name fields survived the down migration")
	}
	if memberships.UpdateRule != nil {
		t.Errorf("memberships.UpdateRule = %q after down, want nil", *memberships.UpdateRule)
	}
	if _, err := app.FindRecordById("memberships", "mln"); err != nil {
		t.Errorf("down migration lost the membership row: %v", err)
	}

	// Up again on the reverted schema: the column comes back empty.
	if err := membershipsLocalNameUp(app); err != nil {
		t.Fatalf("up: %v", err)
	}
	rec, err = app.FindRecordById("memberships", "mln")
	if err != nil {
		t.Fatal(err)
	}
	if got := rec.GetString("local_name"); got != "" {
		t.Errorf("local_name = %q after re-up, want empty", got)
	}
}

// Unnamed memberships remain valid, including those created by joins.
func TestLocalNameIsOptional(t *testing.T) {
	app := newMigratedApp(t)
	col, err := app.FindCollectionByNameOrId("memberships")
	if err != nil {
		t.Fatal(err)
	}
	f, ok := col.Fields.GetByName("local_name").(*core.TextField)
	if !ok {
		t.Fatal("local_name is not a text field")
	}
	if f.Required {
		t.Error("local_name is Required; an unset override must be valid")
	}
}
