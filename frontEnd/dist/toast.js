const notifications = document.querySelector(".notifications");

// Object containing details for different types of toasts
const toastDetails = {
  success: {
    icon: "fa-circle-check",
    text: "Success: This is a success toast.",
    timer: 3000,
  },
  error: {
    icon: "fa-circle-xmark",
    text: "Error: This is an error toast.",
    timer: 5000,
  },
  warning: {
    icon: "fa-triangle-exclamation",
    text: "Warning: This is a warning toast.",
    timer: 4000,
  },
  info: {
    icon: "fa-circle-info",
    text: "Info: This is an information toast.",
    timer: 5000,
  },
};
const removeToast = (toast) => {
  toast.classList.add("hide");
  if (toast.timeoutId) clearTimeout(toast.timeoutId); // Clearing the timeout for the toast
  setTimeout(() => toast.remove(), 500); // Removing the toast after 500ms
};
const createToast = (id, text, timer) => {
  // Getting the icon and text for the toast based on the id passed
  const { icon } = toastDetails[id];
  const toast = document.createElement("li"); // Creating a new 'li' element for the toast
  const thisTimer = timer || toastDetails[id].timer;
  toast.style.setProperty("--animation-duration", thisTimer + "ms");
  toast.className = `toast ${id}`; // Setting the classes for the toast
  // Setting the inner HTML for the toast
  toast.innerHTML = `<div class="column">
                         <i class="fa-solid ${icon}"></i>
                         <span>${text}</span>
                      </div>
                      <i class="fa-solid fa-xmark" onclick="removeToast(this.parentElement)"></i>`;
  notifications.appendChild(toast); // Append the toast to the notification ul
  // Setting a timeout to remove the toast after the specified duration
  toast.timeoutId = setTimeout(() => removeToast(toast), thisTimer);
};
