import { createStore } from "solid-js/store";
import { AppState } from "~/models/app-state";
import { defaultAppState } from "./default-app-state";
import { NotificationType } from "~/models/notification-type";
import { AppTheme } from "~/models/app-theme";

const [store, setStore] = createStore<AppState>(defaultAppState)

const spinner = {
    show: (message?: string) => setStore("spinner", { isVisible: true, message }),
    hide: () => setStore("spinner", { isVisible: false, message: '' })
}

let notificationTimeout: ReturnType<typeof setTimeout> | null = null;
const resetNotification = () =>
    setStore("notification", { isVisible: false, message: '', type: NotificationType.Info });

const _setNotification = (timeoutMs = 5000) => (type: NotificationType) => (message: string) => {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout)
    }
    setStore("notification", { type, message, isVisible: true })
    notificationTimeout = setTimeout(() => {
        resetNotification()
        notificationTimeout = null
    }, timeoutMs)
}

const setNotification = _setNotification()

const notification = {
    success: setNotification(NotificationType.Success),
    info: setNotification(NotificationType.Info),
    warning: setNotification(NotificationType.Warning),
    error: setNotification(NotificationType.Error),
    clear: () => {
        if (notificationTimeout) {
            clearTimeout(notificationTimeout)
            notificationTimeout = null
        }
        resetNotification()
    }
}

const theme = {
    set: (theme: AppTheme) =>
        setStore(
            "appConfig",
            "theme",
            theme === AppTheme.Forest ? AppTheme.Forest : AppTheme.Emerald
        )
}

export default {
    get: store,
    spinner,
    notification,
    theme
}
