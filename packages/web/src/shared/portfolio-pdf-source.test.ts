import { expect, test } from "bun:test";
import { portfolioSourceKey } from "./portfolio-pdf-source";
test("PDF source keys preserve Japanese upload filenames and reject other locations",()=>{
 expect(portfolioSourceKey('/api/images/photos/シ_ョフ__0084-positive.jpg')).toBe('photos/シ_ョフ__0084-positive.jpg');
 for(const url of ['https://example.com/photos/a.jpg','/api/images/thumbs/a.jpg','/api/images/photos/../a.jpg','/api/images/photos/a.jpg?w=3','/api/images/photos/a\\b.jpg'])expect(portfolioSourceKey(url)).toBeNull();
});
