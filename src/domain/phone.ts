import { Destination } from "@sincpro/web-composer/domain/enums";

/**
 * On a phone there is ONE screen. A side panel has no side to dock to and a window has nowhere
 * to float, so they are not shrunk — they are translated into what a phone already has: the page,
 * with its breadcrumb to come back. The peek and the modal stay: a drawer the width of the screen
 * and a sheet from the bottom are what a phone does anyway.
 *
 * It is the WORKSPACE's width that decides, not the device's: a narrow embed on a wide screen is
 * a phone too. Nothing in the model changes: the panels keep their zones, so widening the window
 * brings the desk back as it was.
 */

/** Below this many pixels the workspace is a phone. */
export const PHONE_WIDTH = 640;

/** Where `open(ref, { to })` goes on a phone. */
export function destinationOnPhone(to: Destination): Destination {
  return to === Destination.Window || to === Destination.Side ? Destination.Page : to;
}

/** Where a chooser opens on a phone. Not the page: it would push the form that asked into the
 *  breadcrumb — and the form has to stay where it is to receive the answer. */
export function chooserOnPhone(to: Destination): Destination {
  return to === Destination.Window || to === Destination.Side ? Destination.Modal : to;
}
