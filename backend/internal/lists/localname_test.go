package lists

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"shoppinglist/internal/fieldcontract"
	"shoppinglist/internal/testutil"
)

func TestRenameLocalName(t *testing.T) {
	app, mux := setupListsApp(t)
	alice, token := testutil.CreateAccount(t, app, "Alice")
	bob, bobToken := testutil.CreateAccount(t, app, "Bob")
	list := testutil.CreateList(t, app, "Zuhause")
	own := testutil.AddMembership(t, app, alice, list)
	other := testutil.AddMembership(t, app, bob, list)
	url := "/api/lists/" + list + "/local-name"

	setName := func(body string, revision int, name string) {
		t.Helper()
		rec, out := testutil.DoReq(mux, http.MethodPost, url, body, testutil.AuthHeader(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("rename returned %d: %s", rec.Code, out)
		}
		var result localNameResult
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result != (localNameResult{ID: own.Id, Name: name, Revision: revision}) {
			t.Errorf("rename response = %+v, want revision %d and name %q", result, revision, name)
		}
	}

	max, ok := fieldcontract.MaxBytes("memberships", "local_name")
	if !ok {
		t.Fatal("contract is missing the private name cap")
	}
	atCap := strings.Repeat("ä", max/2) + strings.Repeat("x", max%2)
	payload, _ := json.Marshal(map[string]string{"local_name": atCap})
	atCapBody := string(payload)
	setName(atCapBody, 1, atCap)

	payload, _ = json.Marshal(map[string]string{"local_name": atCap + "x"})
	for _, invalid := range []string{string(payload), `{}`, `{"local_name":null}`} {
		rec, out := testutil.DoReq(mux, http.MethodPost, url, invalid, testutil.AuthHeader(token))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("invalid name returned %d: %s", rec.Code, out)
		}
	}

	setName(atCapBody, 1, atCap)
	setName(`{"local_name":"Ein privater Name"}`, 2, "Ein privater Name")
	setName(`{"local_name":"   "}`, 3, "")
	setName(`{"local_name":""}`, 3, "")

	row, err := app.FindRecordById("memberships", other.Id)
	if err != nil {
		t.Fatal(err)
	}
	if row.GetString("local_name") != "" || row.GetInt("local_name_revision") != 0 {
		t.Error("co-member's private name changed")
	}
	assertListName(t, app, list, "Zuhause")

	otherList := testutil.CreateListFor(t, app, alice, "Andere")
	rec, out := testutil.DoReq(mux, http.MethodPost, "/api/lists/"+otherList+"/local-name",
		`{"local_name":"Name"}`, testutil.AuthHeader(bobToken))
	if rec.Code != http.StatusForbidden {
		t.Errorf("non-member rename returned %d: %s", rec.Code, out)
	}
	rec, out = testutil.DoReq(mux, http.MethodPost, url, `{"local_name":"Name"}`, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous rename returned %d: %s", rec.Code, out)
	}
}

func TestConcurrentLocalNameChangesGetDistinctRevisions(t *testing.T) {
	app, mux := setupListsApp(t)
	account, token := testutil.CreateAccount(t, app, "Alice")
	list := testutil.CreateListFor(t, app, account, "Zuhause")
	url := "/api/lists/" + list + "/local-name"

	responses := make(chan *httptest.ResponseRecorder, 2)
	for _, body := range []string{`{"local_name":"First name"}`, `{"local_name":"Second name"}`} {
		go func() {
			rec, _ := testutil.DoReq(mux, http.MethodPost, url, body, testutil.AuthHeader(token))
			responses <- rec
		}()
	}

	revisions := map[int]bool{}
	for range 2 {
		rec := <-responses
		if rec.Code != http.StatusOK {
			t.Fatalf("rename returned %d: %s", rec.Code, rec.Body)
		}
		var result localNameResult
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		revisions[result.Revision] = true
	}
	if !revisions[1] || !revisions[2] {
		t.Errorf("concurrent renames returned revisions %v, want 1 and 2", revisions)
	}
}
