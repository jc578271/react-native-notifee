/*
 * Copyright (c) 2016-present Invertase Limited
 */

import { AppRegistry, Platform } from 'react-native';
import { Module } from './types/Module';
import {
  AndroidChannel,
  AndroidChannelGroup,
  AndroidNotificationSetting,
  NativeAndroidChannel,
  NativeAndroidChannelGroup,
} from './types/NotificationAndroid';
import {
  AuthorizationStatus,
  InitialNotification,
  Notification,
  Event,
  TriggerNotification,
  DisplayedNotification,
  NotificationSettings,
} from './types/Notification';
import { PowerManagerInfo } from './types/PowerManagerInfo';
import { Trigger } from './types/Trigger';
import NotifeeNativeModule, { NativeModuleConfig } from './NotifeeNativeModule';
import {
  isAndroid,
  isArray,
  isFunction,
  isIOS,
  isNumber,
  isString,
  isUndefined,
  isWeb,
  kReactNativeNotifeeForegroundServiceHeadlessTask,
  kReactNativeNotifeeNotificationBackgroundEvent,
  kReactNativeNotifeeNotificationEvent,
  NotificationType,
} from './utils';
import validateNotification from './validators/validateNotification';
import validateTrigger from './validators/validateTrigger';
import validateAndroidChannel from './validators/validateAndroidChannel';
import validateAndroidChannelGroup from './validators/validateAndroidChannelGroup';
import { IOSNotificationCategory, IOSNotificationPermissions } from './types/NotificationIOS';
import validateIOSCategory from './validators/validateIOSCategory';
import validateIOSPermissions from './validators/validateIOSPermissions';

let backgroundEventHandler: (event: Event) => Promise<void>;

let registeredForegroundServiceTask: (notification: Notification) => Promise<void>;

if (isAndroid) {
  // Register foreground service
  AppRegistry.registerHeadlessTask(kReactNativeNotifeeForegroundServiceHeadlessTask, () => {
    if (!registeredForegroundServiceTask) {
      console.warn(
        '[notifee] no registered foreground service has been set for displaying a foreground notification.',
      );
      return (): Promise<void> => Promise.resolve();
    }

    return ({ notification }): Promise<void> => registeredForegroundServiceTask(notification);
  });
}

export default class NotifeeApiModule extends NotifeeNativeModule implements Module {
  constructor(config: NativeModuleConfig) {
    super(config);
    if (isAndroid) {
      // Register background handler
      AppRegistry.registerHeadlessTask(kReactNativeNotifeeNotificationEvent, () => {
        return (event: Event): Promise<void> => {
          if (!backgroundEventHandler) {
            console.warn(
              '[notifee] no background event handler has been set. Set a handler via the "onBackgroundEvent" method.',
            );
            return Promise.resolve();
          }
          return backgroundEventHandler(event);
        };
      });
    }
  }

  public getTriggerNotificationIds = (): Promise<string[]> => {
    if (isAndroid) {
      return this.native.getTriggerNotificationIds();
    }

    return Promise.resolve([]);
  };

  public getTriggerNotifications = (): Promise<TriggerNotification[]> => {
    if (isAndroid) {
      return this.native.getTriggerNotifications();
    }

    return Promise.resolve([]);
  };

  public getDisplayedNotifications = (): Promise<DisplayedNotification[]> => {
    if (isAndroid) {
      return this.native.getDisplayedNotifications();
    }

    return Promise.resolve([]);
  };

  public isChannelBlocked = (channelId: string): Promise<boolean> => {
    if (!isString(channelId)) {
      throw new Error("notifee.isChannelBlocked(*) 'channelId' expected a string value.");
    }

    if (isWeb || isIOS || this.native.ANDROID_API_LEVEL < 26) {
      return Promise.resolve(false);
    }

    return this.native.isChannelBlocked(channelId);
  };

  public isChannelCreated = (channelId: string): Promise<boolean> => {
    if (!isString(channelId)) {
      channelId;
      throw new Error("notifee.isChannelCreated(*) 'channelId' expected a string value.");
    }

    if (isWeb || isIOS || this.native.ANDROID_API_LEVEL < 26) {
      return Promise.resolve(true);
    }

    return this.native.isChannelCreated(channelId);
  };

  public cancelAllNotifications = (notificationIds?: string[], tag?: string): Promise<void> => {
    if (isAndroid) {
      if (notificationIds) {
        if (isAndroid) {
          return this.native.cancelAllNotificationsWithIds(
            notificationIds,
            NotificationType.ALL,
            tag,
          );
        }
        return this.native.cancelAllNotificationsWithIds(notificationIds);
      }
      return this.native.cancelAllNotifications();
    }

    return Promise.resolve();
  };

  public cancelDisplayedNotifications = (
    notificationIds?: string[],
    tag?: string,
  ): Promise<void> => {
    if (isAndroid) {
      if (notificationIds) {
        if (isAndroid) {
          return this.native.cancelAllNotificationsWithIds(
            notificationIds,
            NotificationType.DISPLAYED,
            tag,
          );
        }

        return this.native.cancelDisplayedNotificationsWithIds(notificationIds);
      }

      return this.native.cancelDisplayedNotifications();
    }

    return Promise.resolve();
  };

  public cancelTriggerNotifications = (notificationIds?: string[]): Promise<void> => {
    if (isAndroid) {
      if (notificationIds) {
        if (isAndroid) {
          return this.native.cancelAllNotificationsWithIds(
            notificationIds,
            NotificationType.TRIGGER,
            null,
          );
        }
        return this.native.cancelTriggerNotificationsWithIds(notificationIds);
      }
      return this.native.cancelTriggerNotifications();
    }

    return Promise.resolve();
  };

  public cancelNotification = (notificationId: string, tag?: string): Promise<void> => {
    if (!isString(notificationId)) {
      throw new Error("notifee.cancelNotification(*) 'notificationId' expected a string value.");
    }

    if (isAndroid) {
      return this.native.cancelAllNotificationsWithIds([notificationId], NotificationType.ALL, tag);
    }

    return Promise.resolve();
  };

  public cancelDisplayedNotification = (notificationId: string, tag?: string): Promise<void> => {
    if (!isString(notificationId)) {
      throw new Error(
        "notifee.cancelDisplayedNotification(*) 'notificationId' expected a string value.",
      );
    }

    if (isAndroid) {
      return this.native.cancelAllNotificationsWithIds(
        [notificationId],
        NotificationType.DISPLAYED,
        tag,
      );
    }

    return Promise.resolve();
  };

  public cancelTriggerNotification = (notificationId: string): Promise<void> => {
    if (!isString(notificationId)) {
      throw new Error(
        "notifee.cancelTriggerNotification(*) 'notificationId' expected a string value.",
      );
    }

    if (isAndroid) {
      return this.native.cancelAllNotificationsWithIds(
        [notificationId],
        NotificationType.TRIGGER,
        null,
      );
    }

    return Promise.resolve();
  };

  public createChannel = (channel: AndroidChannel): Promise<string> => {
    let options: AndroidChannel;
    try {
      options = validateAndroidChannel(channel);
    } catch (e: any) {
      throw new Error(`notifee.createChannel(*) ${e.message}`);
    }

    if (isAndroid) {
      if (this.native.ANDROID_API_LEVEL < 26) {
        return Promise.resolve(options.id);
      }

      return this.native.createChannel(options).then(() => {
        return options.id;
      });
    }

    return Promise.resolve('');
  };

  public createChannels = (channels: AndroidChannel[]): Promise<void> => {
    if (!isArray(channels)) {
      throw new Error("notifee.createChannels(*) 'channels' expected an array of AndroidChannel.");
    }

    const options: AndroidChannel[] = [];
    try {
      for (let i = 0; i < channels.length; i++) {
        options[i] = validateAndroidChannel(channels[i]);
      }
    } catch (e: any) {
      throw new Error(`notifee.createChannels(*) 'channels' a channel is invalid: ${e.message}`);
    }

    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.createChannels(options);
    }

    return Promise.resolve();
  };

  public createChannelGroup = (channelGroup: AndroidChannelGroup): Promise<string> => {
    let options: AndroidChannelGroup;
    try {
      options = validateAndroidChannelGroup(channelGroup);
    } catch (e: any) {
      throw new Error(`notifee.createChannelGroup(*) ${e.message}`);
    }

    if (isAndroid) {
      if (this.native.ANDROID_API_LEVEL < 26) {
        return Promise.resolve(options.id);
      }

      return this.native.createChannelGroup(options).then(() => {
        return options.id;
      });
    }

    return Promise.resolve('');
  };

  public createChannelGroups = (channelGroups: AndroidChannelGroup[]): Promise<void> => {
    if (!isArray(channelGroups)) {
      throw new Error(
        "notifee.createChannelGroups(*) 'channelGroups' expected an array of AndroidChannelGroup.",
      );
    }

    const options = [];
    try {
      for (let i = 0; i < channelGroups.length; i++) {
        options[i] = validateAndroidChannelGroup(channelGroups[i]);
      }
    } catch (e: any) {
      throw new Error(
        `notifee.createChannelGroups(*) 'channelGroups' a channel group is invalid: ${e.message}`,
      );
    }

    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.createChannelGroups(options);
    }

    return Promise.resolve();
  };

  public deleteChannel = (channelId: string): Promise<void> => {
    if (!isString(channelId)) {
      throw new Error("notifee.deleteChannel(*) 'channelId' expected a string value.");
    }

    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.deleteChannel(channelId);
    }

    return Promise.resolve();
  };

  public deleteChannelGroup = (channelGroupId: string): Promise<void> => {
    if (!isString(channelGroupId)) {
      throw new Error("notifee.deleteChannelGroup(*) 'channelGroupId' expected a string value.");
    }

    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.deleteChannelGroup(channelGroupId);
    }

    return Promise.resolve();
  };

  public displayNotification = (notification: Notification): Promise<string> => {
    let options: Notification;
    try {
      options = validateNotification(notification);
    } catch (e: any) {
      throw new Error(`notifee.displayNotification(*) ${e.message}`);
    }

    if (isAndroid) {
      return this.native.displayNotification(options).then((): string => {
        return options.id as string;
      });
    }

    return Promise.resolve('');
  };

  public openAlarmPermissionSettings = (): Promise<void> => {
    if (isAndroid) {
      return this.native.openAlarmPermissionSettings();
    }

    return Promise.resolve();
  };

  public createTriggerNotification = (
    notification: Notification,
    trigger: Trigger,
  ): Promise<string> => {
    let options: Notification;
    let triggerOptions: Trigger;

    try {
      options = validateNotification(notification);
    } catch (e: any) {
      throw new Error(`notifee.createTriggerNotification(*) ${e.message}`);
    }

    try {
      triggerOptions = validateTrigger(trigger);
    } catch (e: any) {
      throw new Error(`notifee.createTriggerNotification(*) ${e.message}`);
    }

    if (isAndroid) {
      return this.native.createTriggerNotification(options, triggerOptions).then((): string => {
        return options.id as string;
      });
    }

    return Promise.resolve('');
  };

  public getChannel = (channelId: string): Promise<NativeAndroidChannel | null> => {
    if (!isString(channelId)) {
      throw new Error("notifee.getChannel(*) 'channelId' expected a string value.");
    }

    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.getChannel(channelId);
    }

    return Promise.resolve(null);
  };

  public getChannels = (): Promise<NativeAndroidChannel[]> => {
    if (isAndroid && this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.getChannels();
    }

    return Promise.resolve([]);
  };

  public getChannelGroup = (channelGroupId: string): Promise<NativeAndroidChannelGroup | null> => {
    if (!isString(channelGroupId)) {
      throw new Error("notifee.getChannelGroup(*) 'channelGroupId' expected a string value.");
    }

    if (isAndroid || this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.getChannelGroup(channelGroupId);
    }

    return Promise.resolve(null);
  };

  public getChannelGroups = (): Promise<NativeAndroidChannelGroup[]> => {
    if (isAndroid || this.native.ANDROID_API_LEVEL >= 26) {
      return this.native.getChannelGroups();
    }

    return Promise.resolve([]);
  };

  public getInitialNotification = (): Promise<InitialNotification | null> => {
    if (isAndroid) {
      return this.native.getInitialNotification();
    }

    return Promise.resolve(null);
  };

  public onBackgroundEvent = (observer: (event: Event) => Promise<void>): void => {
    if (!isAndroid) return;
    if (!isFunction(observer)) {
      throw new Error("notifee.onBackgroundEvent(*) 'observer' expected a function.");
    }

    backgroundEventHandler = observer;
  };

  public onForegroundEvent = (observer: (event: Event) => void): (() => void) => {
    if (!isAndroid) return () => {};
    if (!isFunction(observer)) {
      throw new Error("notifee.onForegroundEvent(*) 'observer' expected a function.");
    }

    const subscriber = this.emitter.addListener(
      kReactNativeNotifeeNotificationEvent,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore See https://github.com/facebook/react-native/pull/36462
      ({ type, detail }) => {
        observer({ type, detail });
      },
    );

    return (): void => {
      subscriber.remove();
    };
  };

  public openNotificationSettings = (channelId?: string): Promise<void> => {
    if (!isUndefined(channelId) && !isString(channelId)) {
      throw new Error("notifee.openNotificationSettings(*) 'channelId' expected a string value.");
    }

    if (isAndroid) {
      return this.native.openNotificationSettings(channelId || null);
    }

    return Promise.resolve();
  };

  public requestPermission = (
    permissions: IOSNotificationPermissions = {},
  ): Promise<NotificationSettings> => {
    if (isAndroid) {
      return this.native
        .requestPermission()
        .then(
          ({
            authorizationStatus,
            android,
          }: Pick<NotificationSettings, 'authorizationStatus' | 'android'>) => {
            return {
              authorizationStatus,
              android,
              ios: {
                alert: 1,
                badge: 1,
                criticalAlert: 1,
                showPreviews: 1,
                sound: 1,
                carPlay: 1,
                lockScreen: 1,
                announcement: 1,
                notificationCenter: 1,
                inAppNotificationSettings: 1,
                authorizationStatus,
              },
              web: {},
            };
          },
        );
    }

    // assume web
    return Promise.resolve({
      authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
      android: {
        alarm: AndroidNotificationSetting.ENABLED,
      },
      ios: {
        alert: 1,
        badge: 1,
        criticalAlert: 1,
        showPreviews: 1,
        sound: 1,
        carPlay: 1,
        lockScreen: 1,
        announcement: 1,
        notificationCenter: 1,
        inAppNotificationSettings: 1,
        authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
      },
      web: {},
    });
  };

  public registerForegroundService(runner: (notification: Notification) => Promise<void>): void {
    if (!isFunction(runner)) {
      throw new Error("notifee.registerForegroundService(_) 'runner' expected a function.");
    }

    if (isAndroid) {
      registeredForegroundServiceTask = runner;
    }

    return;
  }

  public setNotificationCategories = (categories: IOSNotificationCategory[]): Promise<void> => {
    return Promise.resolve();
  };

  public getNotificationCategories = (): Promise<IOSNotificationCategory[]> => {
    return Promise.resolve([]);
  };

  public getNotificationSettings = (): Promise<NotificationSettings> => {
    if (isAndroid) {
      return this.native
        .getNotificationSettings()
        .then(
          ({
            authorizationStatus,
            android,
          }: Pick<NotificationSettings, 'authorizationStatus' | 'android'>) => {
            return {
              authorizationStatus,
              android,
              ios: {
                alert: 1,
                badge: 1,
                criticalAlert: 1,
                showPreviews: 1,
                sound: 1,
                carPlay: 1,
                lockScreen: 1,
                announcement: 1,
                notificationCenter: 1,
                inAppNotificationSettings: 1,
                authorizationStatus,
              },
              web: {},
            };
          },
        );
    }

    // assume web
    return Promise.resolve({
      authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
      android: {
        alarm: AndroidNotificationSetting.ENABLED,
      },
      ios: {
        alert: 1,
        badge: 1,
        criticalAlert: 1,
        showPreviews: 1,
        sound: 1,
        carPlay: 1,
        lockScreen: 1,
        announcement: 1,
        notificationCenter: 1,
        inAppNotificationSettings: 1,
        authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
      },
      web: {},
    });
  };

  public getBadgeCount = (): Promise<number> => {
    return Promise.resolve(0);
  };

  public setBadgeCount = (count: number): Promise<void> => {
    return Promise.resolve();
  };

  public incrementBadgeCount = (incrementBy?: number): Promise<void> => {
    return Promise.resolve();
  };

  public decrementBadgeCount = (decrementBy?: number): Promise<void> => {
    return Promise.resolve();
  };

  public isBatteryOptimizationEnabled = (): Promise<boolean> => {
    if (!isAndroid) {
      return Promise.resolve(false);
    }

    return this.native.isBatteryOptimizationEnabled();
  };

  public openBatteryOptimizationSettings = (): Promise<void> => {
    if (!isAndroid) {
      return Promise.resolve();
    }
    return this.native.openBatteryOptimizationSettings();
  };

  public getPowerManagerInfo = (): Promise<PowerManagerInfo> => {
    if (!isAndroid) {
      // only Android supports this, so instead we
      // return a dummy response to allow the power manager
      // flow work the same on all platforms
      return Promise.resolve({
        manufacturer: Platform.OS,
        activity: null,
      } as PowerManagerInfo);
    }

    return this.native.getPowerManagerInfo();
  };

  public openPowerManagerSettings = (): Promise<void> => {
    if (!isAndroid) {
      return Promise.resolve();
    }
    return this.native.openPowerManagerSettings();
  };

  public stopForegroundService = (): Promise<void> => {
    if (!isAndroid) {
      return Promise.resolve();
    }
    return this.native.stopForegroundService();
  };

  public hideNotificationDrawer = (): void => {
    if (!isAndroid) {
      return;
    }
    return this.native.hideNotificationDrawer();
  };
}
