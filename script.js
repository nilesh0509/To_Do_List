// ---------- STATE & GLOBALS ----------
let tasks = []; // each task: { id, text, completed }
let currentFilter = "all"; // 'all', 'pending', 'completed'

// DOM elements
const taskInput = document.getElementById("taskInput");
const addBtn = document.getElementById("addBtn");
const taskListEl = document.getElementById("taskList");
const taskCounterSpan = document.getElementById("taskCounter");
const errorMsgDiv = document.getElementById("errorMsg");
const filterBtns = document.querySelectorAll(".filter-btn");

// ---------- HELPER FUNCTIONS ----------
// save to localStorage
function saveToLocalStorage() {
  localStorage.setItem("flowTodo_tasks", JSON.stringify(tasks));
}

// load initial data
function loadFromLocalStorage() {
  const stored = localStorage.getItem("flowTodo_tasks");
  if (stored) {
    try {
      tasks = JSON.parse(stored);
      // ensure each task has valid structure (migration)
      tasks = tasks
        .filter((t) => t && typeof t.text === "string")
        .map((t) => ({
          id: t.id || Date.now() + Math.random(),
          text: t.text,
          completed: t.completed === true,
        }));
    } catch (e) {
      tasks = [];
    }
  } else {
    // demo sample tasks
    tasks = [
      { id: 1001, text: "🌟 Explore task animations", completed: false },
      { id: 1002, text: "✅ Mark me as done", completed: true },
      { id: 1003, text: "💾 Tasks survive refresh!", completed: false },
    ];
  }
}

// update pending counter (tasks left)
function updateCounterUI() {
  const pendingCount = tasks.filter((task) => !task.completed).length;
  taskCounterSpan.innerHTML = `📌 ${pendingCount} pending ${pendingCount === 1 ? "task" : "tasks"}`;
}

// check if task matches current filter
function matchesFilter(task) {
  if (currentFilter === "all") return true;
  if (currentFilter === "pending") return !task.completed;
  if (currentFilter === "completed") return task.completed;
  return true;
}

// create task DOM element (li) without appending
function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item";
  if (task.completed) li.classList.add("completed");
  li.setAttribute("data-id", task.id);

  // task text span
  const textSpan = document.createElement("span");
  textSpan.className = "task-text";
  textSpan.textContent = task.text;

  // delete button
  const delBtn = document.createElement("button");
  delBtn.className = "delete-btn";
  delBtn.innerHTML = "✖";
  delBtn.setAttribute("aria-label", "Delete task");

  li.appendChild(textSpan);
  li.appendChild(delBtn);
  return li;
}

// full render based on current filter (used for filter change and initial load)
function renderFullList() {
  taskListEl.innerHTML = "";
  const filteredTasks = tasks.filter((task) => matchesFilter(task));

  if (filteredTasks.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-placeholder";
    emptyDiv.textContent =
      currentFilter === "all"
        ? "✨ No tasks yet. Add one above!"
        : currentFilter === "pending"
          ? "🎉 No pending tasks! Great job."
          : "✔️ No completed tasks here.";
    taskListEl.appendChild(emptyDiv);
  } else {
    filteredTasks.forEach((task) => {
      const taskElement = createTaskElement(task);
      taskListEl.appendChild(taskElement);
    });
  }
  updateCounterUI();
}

// animation remove (for delete OR when toggle makes task disappear from filter)
function animateAndRemoveElement(
  element,
  shouldAlsoDeleteFromArray = false,
  taskId = null,
) {
  if (!element) return;
  // avoid double animation
  if (element.classList.contains("task-remove-animation")) return;
  element.classList.add("task-remove-animation");

  const onFinish = () => {
    element.removeEventListener("animationend", onFinish);
    if (element.parentNode) element.remove();
    // if needed to delete from tasks array (delete action)
    if (shouldAlsoDeleteFromArray && taskId !== null) {
      const index = tasks.findIndex((t) => t.id == taskId);
      if (index !== -1) {
        tasks.splice(index, 1);
        saveToLocalStorage();
        updateCounterUI();
        // after deletion, if filter still active we need to re-check empty placeholder
        // but DOM element already removed, we might need to show empty placeholder if no tasks match filter
        const filteredAfterDelete = tasks.filter((task) => matchesFilter(task));
        if (filteredAfterDelete.length === 0) {
          renderFullList(); // refresh to show placeholder elegantly
        } else {
          updateCounterUI();
        }
      }
    }
  };
  element.addEventListener("animationend", onFinish, { once: true });
}

// add new task with animation (and conditional visibility depending on filter)
function addNewTaskToDOM(task) {
  // only add to DOM if matches current filter
  if (!matchesFilter(task)) return false;

  const taskElement = createTaskElement(task);
  // add subtle animation class (already has fadeSlideIn from css)
  taskListEl.appendChild(taskElement);
  // if there is an empty placeholder, remove it (because we add real task)
  const placeholder = taskListEl.querySelector(".empty-placeholder");
  if (placeholder && tasks.filter((t) => matchesFilter(t)).length === 1) {
    placeholder.remove();
  }
  taskElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}

// refresh full UI after add/delete/toggle changes only needed when filter edge or storage sync
// but we keep hybrid approach. For safety after delete we sometimes call renderFullList when structure changes.
// However we want dynamic add/remove animations, so we handle granular updates.

// ------ CORE OPERATIONS ------
function addTask() {
  const rawText = taskInput.value.trim();
  if (rawText === "") {
    // show error message with timeout
    errorMsgDiv.classList.add("show");
    setTimeout(() => {
      errorMsgDiv.classList.remove("show");
    }, 1800);
    return;
  }

  const newTask = {
    id: Date.now() + Math.random() * 10000,
    text: rawText,
    completed: false,
  };
  tasks.push(newTask);
  saveToLocalStorage();

  // add to DOM depending on current filter (pending tasks are shown if filter all or pending)
  const added = addNewTaskToDOM(newTask);
  // if task not added because filter mismatch (e.g., filter is 'completed' while new task is pending)
  // we still need to update counter and maybe show a subtle hint?
  // but UI remains correct, counter update still needed
  updateCounterUI();

  // if current filter is 'completed' and we added pending task, it's hidden but counter increments pending tasks -> consistent.
  // also if filter is 'all', it appears normally.
  taskInput.value = "";
  taskInput.focus();

  // if there is empty placeholder visible and now we added a task that matches filter -> remove placeholder via addNewTaskToDOM already handled.
  // edge: if filter is 'completed' and we add pending, placeholder stays but counter changes; that's fine.
  // after adding pending while filter is 'completed' no UI change but user sees counter updated.
  // force re-evaluate empty placeholder state if filter shows no tasks after addition? we handle inside addNewTaskToDOM but not triggered. We'll call a helper.
  if (!added && tasks.filter((t) => matchesFilter(t)).length === 0) {
    // there is still empty placeholder visible, keep it
  } else if (!added && tasks.filter((t) => matchesFilter(t)).length > 0) {
    // but if there is currently placeholder because of empty filter before adding, but after adding there are items but they are not displayed due to mismatch? actually if filter completed and no tasks completed, but after adding pending, still no completed -> placeholder remains correct.
  }
  // also if filter all: always added.
}

// Toggle task completion (click on task text or main area)
function toggleTaskCompletion(taskElement, taskId) {
  const task = tasks.find((t) => t.id == taskId);
  if (!task) return;

  // toggle status
  task.completed = !task.completed;
  saveToLocalStorage();

  // update class on element
  if (task.completed) {
    taskElement.classList.add("completed");
  } else {
    taskElement.classList.remove("completed");
  }

  updateCounterUI();

  // check if after toggling, the task still matches current filter
  const stillMatches = matchesFilter(task);
  if (!stillMatches) {
    // remove from DOM with animation (task no longer fits filter)
    animateAndRemoveElement(taskElement, false, null);
  }
}

// Delete task with smooth removal
function deleteTask(taskElement, taskId) {
  // find task index and remove from array after animation
  // we pass flag to delete from array after animation ends
  animateAndRemoveElement(taskElement, true, taskId);
  // double-check immediate update of any potential remaining empty state after deletion will be handled in callback
}

// ------ EVENT DELEGATION (handles clicks on taskList) ------
function handleListClick(e) {
  // find closest task-item
  const taskItem = e.target.closest(".task-item");
  if (!taskItem) return;

  const taskId = Number(taskItem.getAttribute("data-id"));
  // check if click on delete button
  if (
    e.target.classList.contains("delete-btn") ||
    e.target.closest(".delete-btn")
  ) {
    e.stopPropagation();
    deleteTask(taskItem, taskId);
    return;
  }

  // else: toggle completion (click on task-text or anywhere else on item except delete)
  toggleTaskCompletion(taskItem, taskId);
}

// ------ FILTER LOGIC ------
function setFilter(filterType) {
  currentFilter = filterType;
  // update active class on buttons
  filterBtns.forEach((btn) => {
    const btnFilter = btn.getAttribute("data-filter");
    if (btnFilter === currentFilter) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  renderFullList(); // complete re-render respecting new filter
}

// ------ ENTER KEY SUPPORT ------
function onEnterPress(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    addTask();
  }
}

// ------ INITIALIZE APP ------
function init() {
  loadFromLocalStorage();
  currentFilter = "all";
  renderFullList();
  updateCounterUI();

  // Event listeners
  addBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", onEnterPress);
  taskListEl.addEventListener("click", handleListClick);

  // filter buttons event
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const filterValue = btn.getAttribute("data-filter");
      if (filterValue === "all") setFilter("all");
      else if (filterValue === "pending") setFilter("pending");
      else if (filterValue === "completed") setFilter("completed");
    });
  });

  // initial cleanup: any stray empty placeholder correction
  if (tasks.filter((t) => matchesFilter(t)).length === 0) {
    renderFullList();
  }
}

// start everything
init();
