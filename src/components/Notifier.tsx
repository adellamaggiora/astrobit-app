
import { Component, Switch, Match, Show } from "solid-js"
import { TbFillInfoCircle, TbFillAlertHexagon, TbFillCircleCheck, TbFillSquareX, TbOutlineX } from 'solid-icons/tb'
import { Notification } from "../models/notification"
import { NotificationType } from "../models/notification-type"


const Notifier: Component<{ notification: Notification; onClose?: () => void }> = (props) => {

    const iconSize = 24

    const cssMap = new Map<NotificationType, string>()
        .set(NotificationType.Info, "alert-info")
        .set(NotificationType.Success, "alert-success")
        .set(NotificationType.Warning, "alert-warning")
        .set(NotificationType.Error, "alert-error")


    const cssClass = () => {
        const baseCss = "alert fixed top-16 left-0 right-0 z-60 h-10 min-h-0 rounded-none py-1 text-sm"
        const cssClass = cssMap.get(props.notification?.type)
        return `${baseCss} ${cssClass}`;
    }


    return (
        <Show when={props.notification?.isVisible}>
            <div role="alert" class={cssClass()}>
                <Switch>
                    <Match when={props.notification?.type === NotificationType.Info}>
                        <TbFillInfoCircle size={iconSize} />
                    </Match>
                    <Match when={props.notification?.type === NotificationType.Success}>
                        <TbFillCircleCheck size={iconSize} />
                    </Match>
                    <Match when={props.notification?.type === NotificationType.Warning}>
                        <TbFillAlertHexagon size={iconSize} />
                    </Match>
                    <Match when={props.notification?.type === NotificationType.Error}>
                        <TbFillSquareX size={iconSize} />
                    </Match>
                </Switch>
                <span class="flex-1">{props.notification?.message}</span>
                {props.onClose && (
                    <button class="btn btn-ghost btn-xs" type="button" aria-label="Close" onClick={() => props.onClose?.()}>
                        <TbOutlineX size={18} />
                    </button>
                )}
            </div>
        </Show>
    )
}

export default Notifier
