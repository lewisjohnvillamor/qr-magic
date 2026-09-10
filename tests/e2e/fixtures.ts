/**
 * Shared fixtures for the browser suite.
 *
 * The logo lives here rather than in one spec because two of them need the
 * same picture: the decode test, which proves a logoed code still reads, and
 * the media capture, which puts that same code in the README. A README image
 * showing a different logo from the one under test would be a picture of
 * something nobody verified.
 */

/**
 * A 256x256 LV monogram, dark ink on white.
 *
 * Deliberately opaque and high-contrast rather than tinted to match a theme: a
 * logo that shared the code's own colours would let a placement failure hide,
 * whereas this one is unmistakably not a module, so anything wrong with the
 * quiet pad or the snapping shows up as a decode failure rather than a
 * slightly odd-looking centre. It is drawn from primitives here rather than
 * checked in as a binary so the repository carries no opaque asset.
 */
export const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADoElEQVR42u3dQW7CQBAAQR6CxEv4' +
    '/7PgzJnFzG5XK/esJlO2fIh9e0nhbkYgACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQA' +
    'JAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAk' +
    'ACQAJAAkACQABvR43tf+xM8JAAAAABAG8Ivd2uKQAAAAAAAAAAAAAAAAAAAAACQBrF2v+ScEAAAA' +
    'AAAAAAAAAAAAAAAAoA1g1YYNP95pAE4dMQAAAAAAAAAAAAAA12zY9xOYfDYAAAAAAAAAAAAAAAAA' +
    'AAAAAFg3hLEHAwAAAAAAAAAAAAAAAADWz2HmqQAAAAAAAAAAAAAAAOAEADMfNzvbD4CbQPryDwAA' +
    'AAAAAAAAAAAAAHUDte0HAAAAAAAAAAAAAACAYw3sdQwAAPjD8gUv/wAAAAAAAAAAAAAAAJB+Dg5u' +
    'PwBuAunLPwAAAAAAAAAAEH8MaG4/AG4C6cs/AAAAAAAAAAAAAAAARJ+Ds9sPgJtA+vIPAAAAAAAA' +
    'AAAAAAAAOQPx7QcAAAAAAAAAAAAAAICKget/EQAAjLsJuPwDAAAAAAAAAAAAAABAy4DtBwAAAAAA' +
    'AAAAAAAAAAZy8wcAAAAAAAAAAAAAAAAAAACAgczwAQAAAAAAAAAAAAAAgIHW5AEAAAAAAAAAAAAA' +
    'AAAAAABgIDN2AAAAAAAAAAAAAAAAAAAAABjIzBwAAAAAAAAAAAAAAAAYaA0cAAAAAAAAAAAAAAAA' +
    'AAAAAAYy0wYAAAAAAAAAAAAAAAAGWqMGAAAAAAAAAAAAAAAAAAAAgIHMnAEAAAAAAAAAAAAAAICB' +
    '1pABAAAAAAAAAAAAAPBH3WNXAACg/tkI2w8AAAAAAAAAAAAAAAAAAABA6b9mbT8AAAAAAAAAAAAA' +
    'AADkXp1p+wEAAAAAAAAAAAAAAAAAAAAovTzH9gMAAAAAAAAAAAAAAEDuExK2HwAAAAAAAAAAAAAA' +
    'AAAAAIDSS2RtPwAAALAzAAEAgAAAQPMMnDo0AAAAQAAAIAAAEAAAiIHM53YAAAAAAQCAAABAAAAg' +
    'BjIfnAUAAACkagAIAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkA' +
    'CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQDpozdWalpE' +
    'IX9H7QAAAABJRU5ErkJggg==',
  'base64',
);
