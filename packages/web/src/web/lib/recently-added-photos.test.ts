import { describe, expect, test } from "bun:test";
import { splitRecentlyAddedPhotos } from "./recently-added-photos";

type TestPhoto = {
  id: number;
  name: string;
};

const photos: TestPhoto[] = [
  { id: 1, name: "one" },
  { id: 2, name: "two" },
  { id: 3, name: "three" },
  { id: 4, name: "four" },
  { id: 5, name: "five" },
];

const ids = (items: readonly TestPhoto[]) => items.map((photo) => photo.id);

describe("splitRecentlyAddedPhotos", () => {
  test("puts added photos first and removes them from the regular list", () => {
    const result = splitRecentlyAddedPhotos({
      allPhotos: photos,
      displayedPhotos: photos,
      recentlyAddedPhotoIds: new Set([2, 4]),
      enabled: true,
    });

    expect(ids(result.recentlyAddedPhotos)).toEqual([2, 4]);
    expect(ids(result.regularPhotos)).toEqual([1, 3, 5]);
    expect(
      ids([...result.recentlyAddedPhotos, ...result.regularPhotos]),
    ).toEqual([2, 4, 1, 3, 5]);
    expect(
      new Set(
        [...result.recentlyAddedPhotos, ...result.regularPhotos].map(
          (photo) => photo.id,
        ),
      ).size,
    ).toBe(5);
  });

  test("includes added photos outside filters after in-filter added photos", () => {
    const result = splitRecentlyAddedPhotos({
      allPhotos: [photos[4], photos[3], photos[2], photos[1], photos[0]],
      displayedPhotos: [photos[3], photos[1]],
      recentlyAddedPhotoIds: new Set([1, 2, 5]),
      enabled: true,
    });

    expect(ids(result.recentlyAddedPhotos)).toEqual([2, 5, 1]);
    expect(ids(result.regularPhotos)).toEqual([4]);
  });

  test("disabling the section restores the exact filtered and sorted list", () => {
    const displayed = [photos[3], photos[1]];
    const result = splitRecentlyAddedPhotos({
      allPhotos: photos,
      displayedPhotos: displayed,
      recentlyAddedPhotoIds: new Set([1, 2, 5]),
      enabled: false,
    });

    expect(result.recentlyAddedPhotos).toEqual([]);
    expect(result.regularPhotos).toBe(displayed);
    expect(ids(result.regularPhotos)).toEqual([4, 2]);
  });

  test("keeps the section first across multiple view-sort orders", () => {
    const viewOrders = [
      photos,
      [...photos].reverse(),
      [photos[1], photos[3], photos[4], photos[0], photos[2]],
      [photos[2], photos[0], photos[4], photos[3], photos[1]],
    ];

    for (const order of viewOrders) {
      const result = splitRecentlyAddedPhotos({
        allPhotos: order,
        displayedPhotos: order,
        recentlyAddedPhotoIds: new Set([2, 4]),
        enabled: true,
      });
      const combined = [
        ...result.recentlyAddedPhotos,
        ...result.regularPhotos,
      ];

      expect(ids(combined).slice(0, 2)).toEqual(
        ids(order).filter((id) => id === 2 || id === 4),
      );
      expect(ids(result.regularPhotos)).toEqual(
        ids(order).filter((id) => id !== 2 && id !== 4),
      );
    }
  });

  test("orders the section like the sorted list and leaves regular order intact", () => {
    const sortedAll = [photos[4], photos[2], photos[0], photos[3], photos[1]];
    const sortedDisplayed = [photos[2], photos[0], photos[3]];
    const result = splitRecentlyAddedPhotos({
      allPhotos: sortedAll,
      displayedPhotos: sortedDisplayed,
      recentlyAddedPhotoIds: new Set([2, 3, 5]),
      enabled: true,
    });

    expect(ids(result.recentlyAddedPhotos)).toEqual([3, 5, 2]);
    expect(ids(result.regularPhotos)).toEqual([1, 4]);
  });

  test("returns the original displayed array when no photos were added", () => {
    const displayed = [photos[2], photos[0]];
    const result = splitRecentlyAddedPhotos({
      allPhotos: photos,
      displayedPhotos: displayed,
      recentlyAddedPhotoIds: new Set(),
      enabled: true,
    });

    expect(result.recentlyAddedPhotos).toEqual([]);
    expect(result.regularPhotos).toBe(displayed);
  });

  test("drops recently added IDs whose photos disappeared from all photos", () => {
    const remaining = photos.filter((photo) => photo.id !== 4);
    const result = splitRecentlyAddedPhotos({
      allPhotos: remaining,
      displayedPhotos: remaining,
      recentlyAddedPhotoIds: new Set([4]),
      enabled: true,
    });

    expect(result.recentlyAddedPhotos).toEqual([]);
    expect(result.regularPhotos).toBe(remaining);
  });

  test("is deterministic and does not mutate either input array", () => {
    const all = [photos[4], photos[3], photos[2], photos[1], photos[0]];
    const displayed = [photos[3], photos[1]];
    const allBefore = [...all];
    const displayedBefore = [...displayed];
    const input = {
      allPhotos: all,
      displayedPhotos: displayed,
      recentlyAddedPhotoIds: new Set([1, 2, 5]),
      enabled: true,
    };

    const first = splitRecentlyAddedPhotos(input);
    const second = splitRecentlyAddedPhotos(input);

    expect(ids(first.recentlyAddedPhotos)).toEqual(
      ids(second.recentlyAddedPhotos),
    );
    expect(ids(first.regularPhotos)).toEqual(ids(second.regularPhotos));
    expect(all).toEqual(allBefore);
    expect(displayed).toEqual(displayedBefore);
  });
});
