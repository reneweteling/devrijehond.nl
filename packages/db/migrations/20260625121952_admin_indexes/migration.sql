-- DropIndex
DROP INDEX "Vote_spotId_idx";

-- CreateIndex
CREATE INDEX "Amenity_status_idx" ON "Amenity"("status");

-- CreateIndex
CREATE INDEX "Amenity_sortOrder_idx" ON "Amenity"("sortOrder");

-- CreateIndex
CREATE INDEX "Amenity_proposedById_idx" ON "Amenity"("proposedById");

-- CreateIndex
CREATE INDEX "AmenityOnCategory_categoryId_idx" ON "AmenityOnCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Category_status_idx" ON "Category"("status");

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");

-- CreateIndex
CREATE INDEX "Category_proposedById_idx" ON "Category"("proposedById");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");

-- CreateIndex
CREATE INDEX "FeatureRequest_createdAt_idx" ON "FeatureRequest"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_createdAt_idx" ON "FeatureRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureRequest_createdById_idx" ON "FeatureRequest"("createdById");

-- CreateIndex
CREATE INDEX "ModeratorApplication_status_idx" ON "ModeratorApplication"("status");

-- CreateIndex
CREATE INDEX "ModeratorApplication_createdAt_idx" ON "ModeratorApplication"("createdAt");

-- CreateIndex
CREATE INDEX "ModeratorApplication_status_createdAt_idx" ON "ModeratorApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModeratorApplication_decidedById_idx" ON "ModeratorApplication"("decidedById");

-- CreateIndex
CREATE INDEX "Report_resolved_createdAt_idx" ON "Report"("resolved", "createdAt");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Spot_createdAt_idx" ON "Spot"("createdAt");

-- CreateIndex
CREATE INDEX "Spot_status_createdAt_idx" ON "Spot"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Spot_submittedById_idx" ON "Spot"("submittedById");

-- CreateIndex
CREATE INDEX "SpotAmenity_amenityId_idx" ON "SpotAmenity"("amenityId");

-- CreateIndex
CREATE INDEX "SpotPhoto_spotId_idx" ON "SpotPhoto"("spotId");

-- CreateIndex
CREATE INDEX "SpotPhoto_uploadedById_idx" ON "SpotPhoto"("uploadedById");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");
