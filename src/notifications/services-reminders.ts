import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const KEY = 'gastosapp:scheduledServiceNotis'; // { [serviceId]: notificationId[] }

type MapStore = Record<string, string[]>;

async function getMap(): Promise<MapStore> {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
}
async function setMap(m: MapStore) {
    await AsyncStorage.setItem(KEY, JSON.stringify(m));
}

export async function ensurePermissions() {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
    }
}

function atLocal(date: Date, hour = 10, minute = 0) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d;
}

function clampToFuture(d: Date, backupMinutes = 1) {
    const now = new Date();
    return d.getTime() <= now.getTime()
        ? new Date(now.getTime() + backupMinutes * 60 * 1000)
        : d;
}

/** Agenda 1) el día de vencimiento 10:00 y 2) preaviso un día antes 10:00 */
export async function scheduleServiceReminders(serviceId: string, title: string, dueDate: Date, amountLabel: string) {
    await ensurePermissions();

    const map = await getMap();
    if (map[serviceId]?.length) return; // ya agendado en este dispositivo

    const body = `${title} vence hoy. Monto: ${amountLabel}`;
    const bodyPrev = `${title} vence mañana. Monto: ${amountLabel}`;

    const triggerToday: Notifications.DateTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: clampToFuture(atLocal(dueDate, 10, 0)),
    };

    const prev = new Date(dueDate);
    prev.setDate(prev.getDate() - 1);

    const triggerPrev: Notifications.DateTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: clampToFuture(atLocal(prev, 10, 0)),
    };

    const idToday = await Notifications.scheduleNotificationAsync({
        content: { title: 'Servicio por pagar', body },
        trigger: triggerToday,
    });

    const idPrev = await Notifications.scheduleNotificationAsync({
        content: { title: 'Recordatorio de servicio', body: bodyPrev },
        trigger: triggerPrev,
    });

    map[serviceId] = [idPrev, idToday];
    await setMap(map);
}

export async function cancelServiceReminders(serviceId: string) {
    const map = await getMap();
    const ids = map[serviceId] || [];
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    delete map[serviceId];
    await setMap(map);
}
