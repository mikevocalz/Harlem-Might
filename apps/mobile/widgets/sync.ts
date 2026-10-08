/**
 * Type resolution anchor. Metro takes .ios/.android variants. Web and
 * unsupported targets intentionally do not register home screen widgets.
 */
export async function publishHomeWidgets(_snapshot: import('@acme/widgets').WidgetSnapshot): Promise<void> {}
