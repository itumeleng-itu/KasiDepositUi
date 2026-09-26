import { router } from 'expo-router';

/**
 * Where an add screen goes once a payout method is saved. On the first run (`next=deposit`,
 * straight after registering) there is nothing behind to return to: on to the PIN screen, with
 * the onboarding screens cleared so back can't reach them. Otherwise back to wherever the user
 * came from (the list, which refreshes when it regains focus).
 */
export function finishAdding(next: string | undefined): void {
  if (next === 'deposit') {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/deposit');
    return;
  }
  if (router.canGoBack()) router.back();
  else router.replace('/payout-methods');
}
