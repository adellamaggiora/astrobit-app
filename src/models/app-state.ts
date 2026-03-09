import { AppConfig } from "./app-config"
import { Notification } from "./notification"
import { Spinner } from "./spinner"

export interface AppState {
    notification: Notification
    spinner: Spinner
    appConfig: AppConfig
}