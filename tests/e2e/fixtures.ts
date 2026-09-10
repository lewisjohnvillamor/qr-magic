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

/**
 * A 200x200 red heart on white, bleeding off the left, right and bottom edges.
 *
 * Chosen to be awkward on purpose: a subject that runs off the frame is what
 * a logo cropped to its own bounding box looks like, and it is the case that
 * broke background detection the first time. A shape with an unmistakable
 * silhouette also makes a failed conversion obvious — a slab is a slab.
 */
export const HEART_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAE6klEQVR42u3d51YVZxiGYQ8lJqb3' +
    'ZrrpDRARsSs2RERyzmoK6e0EJmuGmEWCe2f6fOV6130C83zX770PFT3d3UcWEsuHd7lDVHWZONsP' +
    'HwPW3cMLCefDp4F19/Bi8vnwsWHlMO5DJ872w8eAde/Rxazy4WPAym3cfybO9sPHgJXnuDnDamHr' +
    'UHNVS8qzgWE9tqQ8GxCWcdnqH5ZZVd9WE1hHlqSeYd07clzaCyyFDev+48el/YGlUGEZUS1s1YG1' +
    'LB2sE6z7TyxLswJLIcEynFrbmgvryWVpfu1gnZDm1xiWydTF1kxYXz91QqoTWJoalrHU0dYsWCtS' +
    '/WrDenpFqh9Ymg6WmdTd1sNgPbMiNa0OrJNS08DSRLC+efak1LT/gWUg9WILLI0Ea1Vq11xYz61K' +
    '7QJLYCkRWM+vSu2aD+uU1C6wNDqsb184JbULLIGlVGCtSe2aC+vFNaldYAksJQLrpTWpXfNhnZba' +
    'BZZGh/Xdy6eldoGl0WGxpe6qZsE6IzWtBqxXzkhNA0tgKSlYr56RmlYH1lmpabV+0c9M6qJqJqzd' +
    '185K9QNLYCk9WJWtc1Kdmv3lye7r56Q6gSWwlCqs0tbRc9L82vzD6u7R89L8wFIwsIqi+P6N89Ks' +
    '5sgBS2ApGViVrQvSweazqQHrzQvSwcBSkLDYUlNVtWG9dUHaX1+wLkr76wcWW2qkqgGsH96+KO3V' +
    'Jyy2VF8VWAoAVmXrknKuPpWGsN65pJwbChZbVIGluGC9e0l5NiysytZl5VZTJG1gsUXVULB+fO+y' +
    '8mk8WGxRBZaiglXZWlfatbbRDdaxdaXdNLDYogosRQWrtPX+utKro4oeYFW2riilupMASwHDKori' +
    'pw+uKI168dAbLLaoAktRwapsXVW89SihZ1ilrQ+vKsb6ZQCWIoHFFlVDwSptfXRVsTQEgKFgVbau' +
    'KfwGen2wwIoNVlEUP398TSE33NMPC4utPFWNAYutDFWNBuu6QisFWKWtT64rnEZ48ZFgsZWVqlFh' +
    'sZWPqrFhlbY+va6pGvOhx4ZV2bqh8Rv5lSeAxVbyqiaD9ctnNzRmucBiK21VU8JiK2FVE8OqbG1o' +
    'uCZ82YlhlbY+39AQTfus08NiKz1VocBiKzFVAcEqbX2xoe4F8poBwaps3VSXwnnKsGCxlYaqEGEV' +
    'RfHrlzfVtNAeMURYbMWuKlxYeMVLKgJYla1NzSrkhwsdVmlrYVMHC/zVIoDFVnSqooHFVlyqYoJV' +
    '2lrcVCyPFROsB7xu5VlczxQfrDxtRfdGUcIqiuK3pVv5FOMDxQorH1uRvk7EsJLnFfW7RA+rsrWV' +
    'XrE/SgqwSlvHt1IqgRdJBFYyvJJ5i6RgxW4rpYdIDVZpa3krxhJ7hQRhPeB1O5aS3D9ZWLHYSnX8' +
    'lGHt3e8nbodZ2rOnDytMW8lvngWsoHhlsnZGsCpb29OWz9R5wSptrWxPVVY7ZwdrEl4ZLpwprDFt' +
    '5TlvvrD+5nVye7hyHjZ3WJWtO0OU+apg9c/LmGD96/5YvdM9M4LVMy/TgdW/LaOBVdPWTv3MBVZD' +
    'Xqd25mcisPq3ZRyw+rdlFrD6sLW2sz+DgNWjra/2MgVY/dsyAlj935+nwQILLLAcWM6B5cByYDkH' +
    'lgPLgeUcWA4sB5ZzYDmwHFjOgeXAcmA5B5YDy4HlHFgOLAeWc/+9vwDEXJPs4BDVPgAAAABJRU5E' +
    'rkJggg==',
  'base64',
);
