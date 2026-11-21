// Migration 1778000026 — a member may give a list a private name ([D-360]).
//
// `local_name` overrides `lists.name` on the member's own screens, empty when
// unset, and `local_name_revision` orders its changes across the member's
// devices. The list route alone writes them: memberships keeps no UpdateRule
// ([D-08]), and its own-rows ListRule keeps them from co-members, in a
// filter's back-relation join too.

package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	pbmigrations "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	pbmigrations.Register(membershipsLocalNameUp, membershipsLocalNameDown, "1778000026_memberships_local_name.go")
}

func membershipsLocalNameUp(app core.App) error {
	memberships, err := app.FindCollectionByNameOrId("memberships")
	if err != nil {
		return err
	}
	memberships.Fields.Add(
		&core.TextField{Name: "local_name"},
		&core.NumberField{Name: "local_name_revision", OnlyInt: true},
	)
	return app.Save(memberships)
}

// membershipsLocalNameDown drops both columns, and the private names with
// them: every member sees the shared name again.
func membershipsLocalNameDown(app core.App) error {
	memberships, err := app.FindCollectionByNameOrId("memberships")
	if err != nil {
		return err
	}
	memberships.Fields.RemoveByName("local_name")
	memberships.Fields.RemoveByName("local_name_revision")
	return app.Save(memberships)
}
