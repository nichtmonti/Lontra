package lists

import (
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"shoppinglist/internal/fieldcontract"
	"shoppinglist/internal/members"
)

type localNameResult struct {
	ID       string `json:"id"`
	Name     string `json:"local_name"`
	Revision int    `json:"local_name_revision"`
}

// renameLocal updates the caller's private list name ([D-360]). The lookup
// and revision increment share a transaction with the save.
func renameLocal(e *core.RequestEvent) error {
	var body struct {
		Name *string `json:"local_name"`
	}
	if err := e.BindBody(&body); err != nil || body.Name == nil {
		return e.BadRequestError("local_name is required", err)
	}
	name := strings.TrimSpace(*body.Name)
	if problem := fieldcontract.OverCap("memberships", "local_name", name); problem != "" {
		return e.BadRequestError(problem, nil)
	}

	var result localNameResult
	if err := e.App.RunInTransaction(func(tx core.App) error {
		row, err := members.Find(tx, e.Auth.Id, e.Request.PathValue("listId"))
		if err != nil {
			return e.InternalServerError("failed to read membership", err)
		}
		if row == nil {
			return e.ForbiddenError("not a member of this list", nil)
		}
		revision := row.GetInt("local_name_revision")
		if row.GetString("local_name") != name {
			revision++
			row.Set("local_name", name)
			row.Set("local_name_revision", revision)
			if err := tx.Save(row); err != nil {
				return e.InternalServerError("failed to save private list name", err)
			}
		}
		result = localNameResult{ID: row.Id, Name: name, Revision: revision}
		return nil
	}); err != nil {
		return err
	}
	return e.JSON(http.StatusOK, result)
}
