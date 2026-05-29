Task created by this client user → no assignees ✅ Yes
C2 Task created by this client user → has assignees ✅ Yes (creators always see their own tasks, client or not)
C3 Task created by admin, client entry = this user's linked client → no assignees ✅ Yes
C4 Task created by admin, client entry = this user's linked client → has assignees, user is NOT one of them ✅ yes
C5 Task assigned directly to this user (regardless of creator) ✅ Yes (need a way to asign the task to user, currently we filter out client users in task editing and creation.)
C6 Task created by another client user ❌ No (never)
Admins (default view) see:

# Condition Visible?

A1 Task created by this admin ✅ Yes
A2 Task assigned to this admin ✅ Yes
A3 Task created by any client user → no assignees ✅ Yes
A4 Task created by any client user → has assignees, admin is NOT one of them ❌ No
A5 Task created by another admin → not assigned to me ❌ No
Admins (Show All) see:

# Condition Visible?

SA1 Every active task ✅ Yes

basically we need a view hierarchy.

created by the user always see the task.
if a task is asigned to you, see the task.
if a task client is linked to client user, that client user sees the task.
if a client made task is not asigned every admin sees the task.
if a client amde task is asigned only asigned users see it.
