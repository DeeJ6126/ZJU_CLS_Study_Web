export const avatarColors = ['#708090', '#2d4a2b', '#4a6fa5', '#36454f', '#0066ff'];

export function getNextAvatarColor(currentColor) {
  const currentIndex = avatarColors.indexOf(currentColor);

  if (currentIndex === -1 || currentIndex === avatarColors.length - 1) {
    return avatarColors[0];
  }

  return avatarColors[currentIndex + 1];
}
